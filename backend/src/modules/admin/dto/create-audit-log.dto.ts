import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  IsObject,
} from 'class-validator';
import { AuditEventType } from '@prisma/client';

export class CreateAuditLogDto {
  @IsEnum(AuditEventType)
  @IsNotEmpty()
  eventType: AuditEventType;

  @IsString()
  @IsNotEmpty()
  entityType: string;

  @IsUUID()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
