import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';

import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { AppException } from '../../common/errors/app.exception';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { AgentService } from './agent/agent.service';
import { ConversationStore } from './conversation.store';
import { CreateConversationDto, SendMessageDto } from './dto/vibe.dto';
import { HEARTBEAT_INTERVAL_MS, VibeEvent } from './interfaces/vibe.interface';

/**
 * Vibe Booking endpoints.
 *
 * The message endpoint answers `text/event-stream` rather than JSON, so it is
 * marked @RawResponse() to skip the response envelope and writes to the Express
 * response directly. Everything is behind JwtAuthGuard: a conversation belongs
 * to an account, and the tools act on that account's behalf.
 */
@Controller('vibe')
@UseGuards(JwtAuthGuard)
export class VibeController {
  constructor(
    private readonly store: ConversationStore,
    private readonly agent: AgentService,
  ) {}

  @Post('conversations')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ) {
    const session = await this.store.create(user.id, dto.title);
    return {
      id: session.conversationId,
      title: session.title,
      messages: [],
      aiAvailable: this.agent.isConfigured,
    };
  }

  @Get('conversations')
  async listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.store.listForUser(user.id);
  }

  @Get('conversations/:id')
  async getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const transcript = await this.store.transcript(user.id, id);
    return { ...transcript, aiAvailable: this.agent.isConfigured };
  }

  /**
   * Streams the concierge's answer.
   *
   * 10 messages a minute: each one can trigger up to five model round-trips and
   * a handful of database queries, so this is the most expensive endpoint we own.
   */
  @Post('conversations/:id/messages')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RawResponse()
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    // Ownership is checked before a single byte of the stream is written, so an
    // intruder still gets a normal 403 envelope.
    const session = await this.store.load(user.id, id);

    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    // Tells nginx and friends not to buffer, which would defeat streaming.
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    const controller = new AbortController();
    const onClose = (): void => controller.abort();
    request.on('close', onClose);

    // Comment frames stop an idle proxy from dropping a long tool call.
    const heartbeat = setInterval(() => {
      if (!response.writableEnded) {
        response.write(': keep-alive\n\n');
      }
    }, HEARTBEAT_INTERVAL_MS);

    try {
      for await (const event of this.agent.run(session, dto.message, controller.signal)) {
        if (response.writableEnded || controller.signal.aborted) {
          break;
        }
        writeEvent(response, event);
      }
    } catch (error) {
      const isDomain = error instanceof AppException;
      writeEvent(response, {
        type: 'error',
        code: isDomain ? error.code : 'AI_UNAVAILABLE',
        message: isDomain
          ? error.message
          : 'The concierge ran into a problem. Please try that again.',
      });
    } finally {
      clearInterval(heartbeat);
      request.off('close', onClose);
      if (!response.writableEnded) {
        response.end();
      }
    }
  }
}

function writeEvent(response: Response, event: VibeEvent): void {
  response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}
