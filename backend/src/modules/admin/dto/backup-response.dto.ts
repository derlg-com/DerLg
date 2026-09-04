import { IsString, IsOptional, IsUUID } from 'class-validator';

export class BackupResponseDto {
  @IsUUID()
  id: string;

  @IsString()
  backupFileUrl: string;

  @IsUUID()
  createdByAdminId: string;

  @IsString()
  @IsOptional()
  backupSizeBytes?: string;

  @IsString()
  createdAt: Date;
}
