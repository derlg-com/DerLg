import { Injectable, Logger } from '@nestjs/common';

interface InlineKeyboardButton {
  text: string;
  callbackData?: string;
  url?: string;
}

interface SendMessageOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyMarkup?: {
    inlineKeyboard: InlineKeyboardButton[][];
  };
}

@Injectable()
export class BotSenderService {
  private readonly logger = new Logger(BotSenderService.name);
  private readonly baseUrl: string;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  private async post<T>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}/${method}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as {
        ok: boolean;
        description?: string;
        result?: T;
      };

      if (!data.ok) {
        this.logger.warn(`Telegram API error (${method}): ${data.description}`);
        throw new Error(data.description || `Telegram API error: ${method}`);
      }

      return data.result as T;
    } catch (error) {
      this.logger.error(
        `Failed to call Telegram API ${method}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    options?: SendMessageOptions,
  ): Promise<{ messageId: number }> {
    const body: Record<string, unknown> = {
      chatId: chatId,
      text,
    };

    if (options?.parseMode) {
      body.parseMode = options.parseMode;
    }

    if (options?.replyMarkup) {
      body.replyMarkup = JSON.stringify(options.replyMarkup);
    }

    return this.post<{ messageId: number }>('sendMessage', body);
  }

  async sendPhoto(
    chatId: string | number,
    photoUrl: string,
    caption?: string,
    options?: SendMessageOptions,
  ): Promise<{ messageId: number }> {
    const body: Record<string, unknown> = {
      chatId: chatId,
      photo: photoUrl,
    };

    if (caption) {
      body.caption = caption;
    }

    if (options?.parseMode) {
      body.parseMode = options.parseMode;
    }

    if (options?.replyMarkup) {
      body.replyMarkup = JSON.stringify(options.replyMarkup);
    }

    return this.post<{ messageId: number }>('sendPhoto', body);
  }

  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options?: SendMessageOptions,
  ): Promise<{ messageId: number }> {
    const body: Record<string, unknown> = {
      chatId: chatId,
      messageId: messageId,
      text,
    };

    if (options?.parseMode) {
      body.parseMode = options.parseMode;
    }

    if (options?.replyMarkup) {
      body.replyMarkup = JSON.stringify(options.replyMarkup);
    }

    return this.post<{ messageId: number }>('editMessageText', body);
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<boolean> {
    const body: Record<string, unknown> = {
      callbackQueryId: callbackQueryId,
    };

    if (text) {
      body.text = text;
    }

    return this.post<boolean>('answerCallbackQuery', body);
  }

  async setWebhook(url: string, secretToken?: string): Promise<boolean> {
    const body: Record<string, unknown> = {
      url,
      allowedUpdates: ['message', 'callback_query', 'edited_message'],
      maxConnections: 40,
    };

    if (secretToken) {
      body.secretToken = secretToken;
    }

    return this.post<boolean>('setWebhook', body);
  }

  async getWebhookInfo(): Promise<{
    url: string;
    hasCustomCertificate: boolean;
    pendingUpdateCount: number;
    ipAddress?: string;
    lastErrorDate?: number;
    lastErrorMessage?: string;
    maxConnections?: number;
  }> {
    return this.post('getWebhookInfo', {});
  }

  async deleteWebhook(): Promise<boolean> {
    return this.post<boolean>('deleteWebhook', {});
  }
}
