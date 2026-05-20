import {
  IsDateString,
  IsNotEmpty,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'toAfterFrom', async: false })
class ToAfterFrom implements ValidatorConstraintInterface {
  validate(to: string, args: ValidationArguments): boolean {
    const obj = args.object as AvailabilityQueryDto;
    if (!obj.from || !to) return true;
    const from = new Date(obj.from);
    const toDate = new Date(to);
    if (toDate <= from) return false;
    const diffDays =
      (toDate.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 90;
  }

  defaultMessage(): string {
    return 'to must be after from and the range must not exceed 90 days';
  }
}

export class AvailabilityQueryDto {
  @IsNotEmpty()
  @IsDateString()
  from: string;

  @IsNotEmpty()
  @IsDateString()
  @Validate(ToAfterFrom)
  to: string;
}
