import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Body for POST /v1/bookings/:id/confirm (sandbox demo payment).
 * `method` selects the payment provider recorded on the Payment row.
 */
export class ConfirmBookingDto {
  @IsOptional()
  @IsString()
  @IsIn(['card', 'bakong_qr', 'aba_qr'])
  method?: 'card' | 'bakong_qr' | 'aba_qr';
}
