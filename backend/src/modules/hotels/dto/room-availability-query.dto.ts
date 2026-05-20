import {
  IsDateString,
  IsNotEmpty,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'checkOutAfterCheckIn', async: false })
class CheckOutAfterCheckIn implements ValidatorConstraintInterface {
  validate(checkOut: string, args: ValidationArguments): boolean {
    const obj = args.object as RoomAvailabilityQueryDto;
    if (!obj.checkIn || !checkOut) return true;
    return new Date(checkOut) > new Date(obj.checkIn);
  }

  defaultMessage(): string {
    return 'checkOut must be after checkIn';
  }
}

export class RoomAvailabilityQueryDto {
  @IsNotEmpty()
  @IsDateString()
  checkIn: string;

  @IsNotEmpty()
  @IsDateString()
  @Validate(CheckOutAfterCheckIn)
  checkOut: string;
}
