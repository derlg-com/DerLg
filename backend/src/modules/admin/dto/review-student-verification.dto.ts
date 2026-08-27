import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { VerificationStatus } from '@prisma/client';

export class ReviewStudentVerificationDto {
  @IsEnum(VerificationStatus)
  @IsNotEmpty()
  status: VerificationStatus;

  @IsString()
  @IsOptional()
  reviewNotes?: string;
}
