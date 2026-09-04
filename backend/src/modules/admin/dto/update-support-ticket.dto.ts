import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { TicketPriority, TicketStatus } from '@prisma/client';

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}

export class AssignSupportTicketDto {
  /**
   * The admin taking the ticket. A UUID because support_tickets.assigned_to now
   * carries a foreign key to users.
   */
  @IsUUID()
  assignedTo: string;
}
