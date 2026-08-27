import { IsUUID, IsNotEmpty, IsInt, IsString, Min, Max } from 'class-validator';

export class AdjustLoyaltyDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsInt()
  @Min(-10000)
  @Max(10000)
  points: number;

  @IsString()
  @IsNotEmpty()
  description: string;
}
