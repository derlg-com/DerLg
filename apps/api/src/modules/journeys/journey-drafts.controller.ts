import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CreateJourneyDraftDto, PatchJourneyDraftDto } from './dto/journey-draft.dto';
import { DraftView } from './interfaces/journey-draft.interface';
import { JourneyDraftsService } from './journey-drafts.service';

/**
 * Drafts belong to a signed-in traveller, so every route is guarded and scoped
 * to the caller. Ownership is enforced in the service, not just here.
 */
@Controller('journey-drafts')
@UseGuards(JwtAuthGuard)
export class JourneyDraftsController {
  constructor(private readonly drafts: JourneyDraftsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Draft created')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateJourneyDraftDto,
  ): Promise<DraftView> {
    return this.drafts.create(user.id, dto);
  }

  @Get()
  @ResponseMessage('Drafts retrieved')
  list(@CurrentUser() user: AuthenticatedUser): Promise<DraftView[]> {
    return this.drafts.findAll(user.id);
  }

  @Get(':id')
  @ResponseMessage('Draft retrieved')
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DraftView> {
    return this.drafts.findOne(user.id, id);
  }

  /** Editor autosave: a batch of named operations, revalidated and repriced. */
  @Patch(':id')
  @ResponseMessage('Draft updated')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  patch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchJourneyDraftDto,
  ): Promise<DraftView> {
    return this.drafts.patch(user.id, id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Draft deleted')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    return this.drafts.remove(user.id, id);
  }
}
