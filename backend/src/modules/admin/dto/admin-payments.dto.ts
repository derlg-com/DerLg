import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaymentProvider, PaymentStatus } from '@prisma/client';

import { AdminDateRangeQueryDto } from './admin-list-query.dto';

/**
 * `GET /v1/admin/payments`
 *
 * `search` matches the booking reference or the provider's settlement id, which
 * are the two things an operator has in front of them: a customer quoting their
 * booking code, or a line on a bank statement.
 */
export class ListPaymentsDto extends AdminDateRangeQueryDto {
  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}

/** `GET /v1/admin/refunds` */
export class ListRefundsDto extends AdminDateRangeQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;
}

/**
 * `POST /v1/admin/payments/:id/settle`
 *
 * Body deliberately requires the bank transaction id rather than defaulting it.
 * This endpoint marks a booking paid, so it must be impossible to invoke without
 * naming the ABA transaction that justifies it — that id is what ties the
 * settlement to a line on the merchant statement, and it is stored in a unique
 * column so the same transaction cannot settle two bookings.
 */
export class SettlePaymentManuallyDto {
  /**
   * ABA transaction id from the credit alert, e.g. `178220228091798`.
   * Digits only: it is echoed into `provider_payment_id`, and accepting free text
   * would let an operator type anything and defeat the traceability.
   */
  @IsString()
  @Matches(/^\d{6,32}$/, {
    message:
      'abaTrxId must be the numeric ABA transaction id from the credit alert (6-32 digits)',
  })
  abaTrxId: string;

  /** Recorded in the audit log. Required, because this action needs justifying. */
  @IsString()
  @MinLength(10, {
    message:
      'Give a reason of at least 10 characters explaining why this payment is being settled by hand',
  })
  @MaxLength(500)
  reason: string;
}

/**
 * `PATCH /v1/admin/refunds/:id/complete`
 *
 * Confirms that an ABA refund was actually transferred. Until this is called the
 * payment's `refunded_amount_usd` stays put, so the books never show money
 * returned before it was.
 */
export class CompleteRefundDto {
  /** Bank transfer reference for the payout, so the refund is reconcilable. */
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  providerRefundId: string;

  @IsString()
  @MinLength(10, {
    message: 'Give a reason of at least 10 characters describing the payout',
  })
  @MaxLength(500)
  reason: string;
}
