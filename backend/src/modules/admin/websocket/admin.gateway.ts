import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AdminRole } from '@prisma/client';
import { Server, Socket } from 'socket.io';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

import type Redis from 'ioredis';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

interface ConnectedAdmin {
  socketId: string;
  userId: string;
  adminRole: AdminRole;
  email: string;
}

/** Wire envelope pushed to admin clients. */
interface AdminEventEnvelope {
  event: string;
  data: unknown;
  timestamp: string;
}

/** Redis channels the gateway relays. */
const REDIS_PATTERNS = [
  'admin_events',
  'driver_status_changed:*',
  'emergency_alerts',
  'driver_assignments',
] as const;

/**
 * Which roles may see each event class.
 *
 * Emergency alerts carry a customer's live GPS position, so they are not
 * broadcast to every admin — only to the roles that act on them.
 */
const EVENT_AUDIENCE: Record<string, AdminRole[]> = {
  DRIVER_STATUS_UPDATE: [
    AdminRole.FLEET_MANAGER,
    AdminRole.OPERATIONS_MANAGER,
    AdminRole.SUPER_ADMIN,
  ],
  DRIVER_ASSIGNMENT: [
    AdminRole.FLEET_MANAGER,
    AdminRole.OPERATIONS_MANAGER,
    AdminRole.SUPER_ADMIN,
  ],
  EMERGENCY_ALERT: [AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN],
  ADMIN_EVENT: [
    AdminRole.SUPPORT_AGENT,
    AdminRole.FLEET_MANAGER,
    AdminRole.OPERATIONS_MANAGER,
    AdminRole.SUPER_ADMIN,
  ],
};

/**
 * Reads the CORS allowlist at handshake time.
 *
 * `@WebSocketGateway` options are evaluated when the class is defined, before
 * Nest has built the DI container, so `ConfigService` is not available here. A
 * callback defers the lookup to the actual request, which is also what makes the
 * value reloadable rather than frozen at import.
 *
 * The previous `origin: []` was a literal empty allowlist: socket.io rejected
 * every browser origin, so no admin client could ever complete the handshake.
 * `afterInit` tried to patch it by assigning `server._corsOrigins`, which is not
 * a property socket.io reads.
 */
function corsOriginCheck(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  const allowed = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Same-origin and non-browser clients send no Origin header.
  if (!origin) return callback(null, true);

  return callback(null, allowed.includes(origin));
}

/**
 * Real-time admin channel.
 *
 * Authentication happens in `handleConnection`, not via `@UseGuards`: Nest's
 * HTTP guards do not run for the socket.io handshake, so decorating the gateway
 * with them would look secure while admitting everyone. Every socket must
 * present a valid access token AND hold an active `admin_users` grant.
 */
@WebSocketGateway({
  namespace: 'v1/admin/ws',
  cors: { origin: corsOriginCheck, credentials: true },
})
export class AdminGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AdminGateway.name);
  private readonly connectedAdmins = new Map<string, ConnectedAdmin>();
  private subscriber?: Redis;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(): void {
    // Origins are resolved per handshake by `corsOriginCheck` above, so there is
    // nothing to configure here.
    const origins = (this.configService.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    this.logger.log(
      `Admin WebSocket gateway initialised on namespace /v1/admin/ws ` +
        `(allowed origins: ${origins.join(', ') || 'none configured'})`,
    );

    if (origins.length === 0) {
      this.logger.warn(
        'CORS_ORIGINS is empty; every browser socket handshake will be rejected',
      );
    }

    this.subscribeToRedis();
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn('Socket rejected: no token', { socketId: client.id });
        client.disconnect(true);
        return;
      }

      const payload = await this.verifyToken(token);
      if (!payload?.sub) {
        this.logger.warn('Socket rejected: invalid token', {
          socketId: client.id,
        });
        client.disconnect(true);
        return;
      }

      // The token proves identity; the grant proves authorisation. Checked live
      // rather than from cache so a revoked admin is cut off immediately.
      const adminUser = await this.prisma.adminUser.findUnique({
        where: { userId: payload.sub },
        select: { adminRole: true, isActive: true },
      });

      if (!adminUser || !adminUser.isActive) {
        this.logger.warn('Socket rejected: no active admin grant', {
          socketId: client.id,
          userId: payload.sub,
        });
        client.disconnect(true);
        return;
      }

      await client.join(`room:${adminUser.adminRole}`);
      await client.join('room:all');

      this.connectedAdmins.set(client.id, {
        socketId: client.id,
        userId: payload.sub,
        adminRole: adminUser.adminRole,
        email: payload.email,
      });

      this.logger.log('Admin socket connected', {
        socketId: client.id,
        userId: payload.sub,
        adminRole: adminUser.adminRole,
      });

      client.emit('connected', {
        socketId: client.id,
        role: adminUser.adminRole,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Socket connection failed', {
        socketId: client.id,
        error: (error as Error).message,
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const admin = this.connectedAdmins.get(client.id);
    if (admin) {
      this.connectedAdmins.delete(client.id);
      this.logger.log('Admin socket disconnected', {
        socketId: client.id,
        userId: admin.userId,
      });
      return;
    }
    this.logger.log('Socket disconnected', { socketId: client.id });
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string') return auth.token;

    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string') return queryToken;
    if (Array.isArray(queryToken) && queryToken.length > 0)
      return queryToken[0];

    return null;
  }

  private async verifyToken(token: string): Promise<JwtPayload | null> {
    // Same secret as the HTTP layer. No fallback: if JWT_ACCESS_SECRET is
    // missing, every socket must fail closed rather than verify against a
    // guessable default.
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      this.logger.error(
        'JWT_ACCESS_SECRET is not configured; rejecting socket',
      );
      return null;
    }

    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, { secret });
    } catch {
      return null;
    }
  }

  private subscribeToRedis(): void {
    // A subscribed ioredis connection cannot serve normal commands, so this must
    // be its own connection rather than the shared client.
    this.subscriber = this.redis.getClient().duplicate();

    void this.subscriber.psubscribe(...REDIS_PATTERNS, (err) => {
      if (err) {
        this.logger.error('Redis psubscribe failed', { error: err.message });
        return;
      }
      this.logger.log(
        `Subscribed to Redis patterns: ${REDIS_PATTERNS.join(', ')}`,
      );
    });

    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      let payload: unknown;
      try {
        payload = JSON.parse(message);
      } catch {
        payload = { raw: message };
      }
      this.broadcastEvent(channel, payload);
    });

    this.subscriber.on('error', (err: Error) => {
      this.logger.error('Redis subscriber error', { error: err.message });
    });
  }

  private broadcastEvent(channel: string, payload: unknown): void {
    // Channel names must match what the publishers actually use.
    //
    // This map was keyed in camelCase (`adminEvents`, `emergencyAlerts`,
    // `driverAssignments`) while every publisher — `AdminEventsService`,
    // `AdminAssignmentsService`, `AdminEmergencyService` and the Telegram
    // handlers — publishes snake_case (`admin_events`, `emergency_alerts`,
    // `driver_assignments`). Nothing matched, so all three fell through to
    // 'UNKNOWN' and were dropped by the audience check below. Emergency alerts in
    // particular were subscribed to, received, and then silently discarded.
    const event = channel.startsWith('driver_status_changed:')
      ? 'DRIVER_STATUS_UPDATE'
      : ({
          admin_events: 'ADMIN_EVENT',
          emergency_alerts: 'EMERGENCY_ALERT',
          driver_assignments: 'DRIVER_ASSIGNMENT',
        }[channel] ?? 'UNKNOWN');

    const envelope: AdminEventEnvelope = {
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    };

    const audience = EVENT_AUDIENCE[event];
    if (!audience) {
      // Unrecognised channel: send to no one rather than fanning out data whose
      // sensitivity we have not classified.
      this.logger.warn('Dropping event from unmapped channel', { channel });
      return;
    }

    // Emit once per role room. Deliberately not also emitting to `room:all`:
    // doing both delivered role-scoped events twice to privileged admins and
    // leaked them to roles that should not see them.
    for (const role of audience) {
      this.server.to(`room:${role}`).emit('message', envelope);
    }
  }

  /** Pushes an event to one role's room. */
  broadcastToRole(role: AdminRole, event: string, data: unknown): void {
    this.server.to(`room:${role}`).emit(event, data);
  }

  getConnectedClients(): ConnectedAdmin[] {
    return Array.from(this.connectedAdmins.values());
  }

  /** Closes the dedicated subscriber connection on shutdown. */
  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
  }
}
