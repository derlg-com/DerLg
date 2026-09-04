import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AbaKhqrService } from './services/aba-khqr.service';
import { PaymentsService } from './services/payments.service';

/**
 * Minimal surface of the GramJS pieces used here.
 *
 * GramJS is imported dynamically (see `connect`), so these describe the runtime
 * shape rather than importing types from a package that may be absent.
 */
interface TelegramMessageEvent {
  message?: { message?: string; senderId?: unknown; chatId?: unknown };
  chatId?: unknown;
}

type NewMessageHandler = (event: TelegramMessageEvent) => Promise<void>;

interface TelegramClientLike {
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  getMe(): Promise<{ id?: unknown; username?: string } | undefined>;
  addEventHandler(handler: NewMessageHandler, event: unknown): void;
  setLogLevel?(level: string): void;
}

/**
 * Watches the ABA alert group and settles payments.
 *
 * ## Why a user account rather than a bot
 *
 * ABA's credit alerts are posted by ABA's own bot. The Telegram **Bot API**
 * forbids one bot from reading another bot's messages in a group, so a
 * `node-telegram-bot-api` listener would connect successfully and then never
 * receive a single alert. A real user account over MTProto has no such
 * restriction, which is why this uses GramJS and a session string.
 *
 * ## Trust model
 *
 * A credit alert is an instruction to mark a booking paid, so two checks gate it:
 *
 *  1. **Chat**: the message must come from `ABA_TELEGRAM_GROUP_ID`.
 *  2. **Sender**: the message must come from an id in `ABA_ALERT_SENDER_IDS`.
 *
 * The second check is the important one and is not optional in spirit. Group
 * membership is not authorisation — anyone able to post in that group could send
 * text matching ABA's format and confirm a booking nobody paid for. When the
 * allowlist is empty the listener still runs (a locked-down group is a valid
 * setup) but logs a warning at startup so the exposure is visible.
 *
 * ## Multiple application instances
 *
 * Every instance running this listener receives the same alert. That is safe
 * rather than duplicated: settlement is keyed on the ABA transaction id, which is
 * unique in the database, so exactly one instance wins the race.
 */
@Injectable()
export class AbaTelegramListener
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(AbaTelegramListener.name);
  private client: TelegramClientLike | null = null;
  private allowedSenderIds = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly aba: AbaKhqrService,
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit(): void {
    // Never block boot on the listener. A Telegram outage or an unconfigured
    // session must not take the whole API down — card payments and the catalogue
    // are unaffected by ABA being offline.
    void this.start().catch((error: Error) => {
      this.logger.error('ABA listener failed to start', {
        error: error.message,
      });
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop();
  }

  /** Whether the listener has everything it needs to run. */
  isConfigured(): boolean {
    return (
      Number(this.config.get<number>('TELEGRAM_API_ID') ?? 0) > 0 &&
      (this.config.get<string>('TELEGRAM_API_HASH') ?? '') !== '' &&
      (this.config.get<string>('TELEGRAM_SESSION') ?? '') !== ''
    );
  }

  async start(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'ABA Telegram listener not started: TELEGRAM_API_ID, TELEGRAM_API_HASH or ' +
          'TELEGRAM_SESSION is missing. ABA QR codes will still be generated, but ' +
          'payments will not confirm automatically. Run `npm run telegram:login`.',
      );
      return;
    }
    if (!this.aba.isConfigured()) {
      this.logger.warn(
        'ABA Telegram listener not started: ABA_STATIC_QR is not configured, so ' +
          'no ABA payment can exist to confirm.',
      );
      return;
    }

    this.allowedSenderIds = new Set(
      (this.config.get<string>('ABA_ALERT_SENDER_IDS') ?? '')
        .split(',')
        .map((id) => this.aba.normalizeTelegramId(id.trim()))
        .filter(Boolean),
    );

    if (this.allowedSenderIds.size === 0) {
      this.logger.warn(
        'ABA_ALERT_SENDER_IDS is empty: any member of the alert group can post a ' +
          'message that settles a booking. Set it to ABA bot id(s), or verify the ' +
          'group is restricted to ABA.',
      );
    }

    await this.connect();
  }

  async stop(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.disconnect();
      this.logger.log('ABA Telegram listener disconnected');
    } catch (error) {
      this.logger.warn('ABA listener disconnect failed', {
        error: (error as Error).message,
      });
    } finally {
      this.client = null;
    }
  }

  private async connect(): Promise<void> {
    // Imported at call time, not at module load. GramJS opens sockets and is a
    // heavy dependency; requiring it eagerly would make every unit test in the
    // payments module pay for a Telegram client it never uses.
    const { TelegramClient } = await import('telegram');
    const { StringSession } = await import('telegram/sessions');
    const { NewMessage } = await import('telegram/events');

    const session = new StringSession(
      this.config.get<string>('TELEGRAM_SESSION'),
    );

    const client = new TelegramClient(
      session,
      Number(this.config.get<number>('TELEGRAM_API_ID')),
      this.config.get<string>('TELEGRAM_API_HASH')!,
      { connectionRetries: 5, autoReconnect: true },
    ) as unknown as TelegramClientLike;

    // GramJS logs verbosely at info level, including connection internals.
    client.setLogLevel?.('error');

    await client.connect();
    const me = await client.getMe();

    client.addEventHandler(
      (event: TelegramMessageEvent) => this.onMessage(event),
      new NewMessage({}),
    );

    this.client = client;

    this.logger.log('ABA Telegram listener started', {
      account:
        me?.username ?? this.aba.normalizeTelegramId(me?.id) ?? 'unknown',
      group: this.config.get<string>('ABA_TELEGRAM_GROUP_ID') || '(any)',
      senderAllowlist: this.allowedSenderIds.size,
    });
  }

  /**
   * Handles one incoming Telegram message.
   *
   * Never throws: an unhandled rejection inside a GramJS event handler tears down
   * the client's update loop, which would silently stop all future confirmations.
   */
  private async onMessage(event: TelegramMessageEvent): Promise<void> {
    try {
      const text = event.message?.message;
      if (!text) return;

      const expectedGroup =
        this.config.get<string>('ABA_TELEGRAM_GROUP_ID') ?? '';
      const chatId = event.chatId ?? event.message?.chatId;

      if (
        expectedGroup !== '' &&
        this.aba.normalizeTelegramId(chatId) !==
          this.aba.normalizeTelegramId(expectedGroup)
      ) {
        return; // Another chat the account happens to be in.
      }

      const parsed = this.aba.parseCreditAlert(text);
      // Most group traffic is not a payment alert; not worth logging.
      if (!parsed) return;

      // Authorisation is checked only once the message looks like money, so a
      // chatty group does not produce a warning per message.
      const senderId = this.aba.normalizeTelegramId(event.message?.senderId);
      if (
        this.allowedSenderIds.size > 0 &&
        !this.allowedSenderIds.has(senderId)
      ) {
        this.logger.error(
          'Discarded a payment-shaped message from an unauthorised sender',
          { senderId, amountUsd: parsed.amountUsd, trxId: parsed.trxId },
        );
        return;
      }

      await this.payments.settleAbaAlert(parsed);
    } catch (error) {
      this.logger.error('Failed to process a Telegram message', {
        error: (error as Error).message,
      });
    }
  }
}
