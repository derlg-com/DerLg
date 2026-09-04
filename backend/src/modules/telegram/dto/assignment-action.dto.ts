import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class AssignmentActionDto {
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
