import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, CommandResponse } from './command.handler';
import { CallbackHandler } from './callback.handler';
import { LocationHandler } from './location.handler';
import { SessionService } from '../services/session.service';
import { TelegramService } from '../telegram.service';

import type {
  TelegramCallbackQueryDto,
  WebhookUpdateDto,
} from '../dto/webhook-update.dto';

@Injectable()
export class MessageHandler {
  private readonly logger = new Logger(MessageHandler.name);

  constructor(
    private readonly commandHandler: CommandHandler,
    private readonly callbackHandler: CallbackHandler,
    private readonly locationHandler: LocationHandler,
    private readonly sessionService: SessionService,
    private readonly telegramService: TelegramService,
  ) {}

  async handleUpdate(
    update: WebhookUpdateDto,
  ): Promise<CommandResponse | null> {
    const telegramId = this.extractTelegramId(update);
    if (!telegramId) {
      this.logger.warn('No telegram_id found in update');
      return null;
    }

    // Check session state for multi-step flows
    const session = await this.sessionService.getSession(telegramId);

    if (update.callbackQuery) {
      return this.handleCallback(telegramId, update.callbackQuery);
    }

    if (update.message) {
      // Handle location sharing
      if (update.message.location) {
        return this.locationHandler.handleLocation(
          telegramId,
          update.message.location.latitude,
          update.message.location.longitude,
        );
      }

      // Handle text messages
      if (update.message.text) {
        // Check session state for support request
        if (session?.state === 'support_request') {
          return this.handleSupportMessage(telegramId, update.message.text);
        }

        // Check if text looks like registration credentials
        if (
          session?.state === 'registration' ||
          (!session && this.looksLikeCredentials(update.message.text))
        ) {
          return this.handleRegistrationMessage(
            telegramId,
            update.message.text,
          );
        }

        // Handle commands
        if (update.message.text.startsWith('/')) {
          // Only the command word is used. `handleCommand` dispatches purely on
          // the command itself — none of the driver commands take arguments — so
          // the remainder of the line is deliberately ignored rather than passed
          // through unused.
          const command = update.message.text.split(' ')[0];
          return this.commandHandler.handleCommand(telegramId, command);
        }

        // Default response
        return {
          text: 'Received your message. Use /help to see available commands.',
        };
      }
    }

    return null;
  }

  private async handleCallback(
    telegramId: string,
    callbackQuery: TelegramCallbackQueryDto,
  ): Promise<CommandResponse> {
    const data = callbackQuery.data || '';
    const response = await this.callbackHandler.handleCallback(
      telegramId,
      data,
    );

    return response;
  }

  private async handleSupportMessage(
    telegramId: string,
    message: string,
  ): Promise<CommandResponse> {
    try {
      const result = await this.telegramService.createSupportTicket({
        telegramId,
        message,
      });

      await this.sessionService.clearSession(telegramId);

      return {
        text: `Support ticket #${result.ticketId} created. Our team will respond within 30 minutes.`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create support ticket: ${(error as Error).message}`,
      );
      return {
        text: 'Failed to create support ticket. Please try again or contact dispatch directly.',
      };
    }
  }

  private async handleRegistrationMessage(
    telegramId: string,
    text: string,
  ): Promise<CommandResponse> {
    // Parse credentials: "driver_id: DRV001 pin: 1234"
    const driverIdMatch = text.match(/driver_id:\s*(\S+)/i);
    const pinMatch = text.match(/pin:\s*(\S+)/i);

    if (!driverIdMatch || !pinMatch) {
      return {
        text:
          'Invalid format. Please use:\n\n' +
          'driver_id: YOUR_ID\n' +
          'pin: YOUR_PIN\n\n' +
          'Example:\n' +
          'driver_id: DRV001\n' +
          'pin: 1234',
      };
    }

    try {
      const result = await this.telegramService.registerDriver({
        telegramId,
        driverId: driverIdMatch[1],
        pin: pinMatch[1],
      });

      return {
        text:
          `Registration successful!\n\n` +
          `Welcome, ${result.driverName}. You can now use the bot.`,
        keyboard: {
          inlineKeyboard: [
            [
              { text: '🟢 Go Online', callbackData: 'status:online' },
              { text: '📊 View Status', callbackData: 'status:view' },
            ],
          ],
        },
      };
    } catch (error) {
      this.logger.error(`Registration failed: ${(error as Error).message}`);
      return {
        text: 'Registration failed. Please check your driver ID and PIN and try again.',
      };
    }
  }

  private looksLikeCredentials(text: string): boolean {
    return /driver_id:/i.test(text) && /pin:/i.test(text);
  }

  private extractTelegramId(update: WebhookUpdateDto): string | null {
    if (update.message?.from?.id) {
      return String(update.message.from.id);
    }
    if (update.callbackQuery?.from?.id) {
      return String(update.callbackQuery.from.id);
    }
    return null;
  }
}
