import { IsEnum, IsUUID } from 'class-validator';

/**
 * Payment methods a customer can choose.
 *
 * Deliberately not the Prisma `PaymentProvider` enum: `bakong` exists as a
 * provider value for historical rows but has no implementation, so offering it
 * here would let a customer pick a method that cannot take money.
 */
export enum PaymentMethod {
  /** Stripe card / wallet. */
  CARD = 'card',
  /** ABA Bank dynamic KHQR. */
  ABA_QR = 'aba_qr',
}

/** `POST /v1/payments/intents` */
export class CreatePaymentIntentDto {
  @IsUUID()
  bookingId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}

/** `GET /v1/payments/status` */
export class PaymentStatusQueryDto {
  @IsUUID()
  bookingId: string;
}
