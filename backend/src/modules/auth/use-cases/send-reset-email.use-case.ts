import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class SendResetEmailUseCase {
  private readonly logger = new Logger(SendResetEmailUseCase.name);
  private readonly resend: Resend | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async execute(to: string, resetLink: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY not configured; skipping email to ${to}`,
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: 'DerLg <noreply@derlg.com>',
        to,
        subject: 'Reset your DerLg password',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your DerLg account.</p>
            <p>
              <a
                href="${resetLink}"
                style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;"
              >
                Reset Password
              </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p><code>${resetLink}</code></p>
            <p style="color: #6b7280; font-size: 12px;">
              This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
        text: `Reset your password: ${resetLink}\n\nThis link expires in 1 hour.`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send reset email to ${to}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
