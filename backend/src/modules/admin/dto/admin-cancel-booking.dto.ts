import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `POST /v1/admin/bookings/:id/cancel`.
 *
 * The handler previously read a bare `@Body('cancel_reason')` with no DTO, so
 * the reason was neither validated nor length-bounded, and the admin panel — which
 * sends `{ reason }` — had its value silently dropped into the audit log as
 * `undefined`.
 *
 * Both spellings are accepted because the admin client sends `reason` while the
 * original contract documented `cancel_reason`; rejecting one of them would break
 * a caller for no benefit. `reason` wins when both are present.
 */
export class AdminCancelBookingDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  cancel_reason?: string;

  /** The reason to persist, whichever spelling the caller used. */
  get resolvedReason(): string | undefined {
    return this.reason ?? this.cancel_reason;
  }
}
