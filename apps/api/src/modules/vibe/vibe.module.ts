import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CatalogModule } from '../catalog/catalog.module';
import { JourneysModule } from '../journeys/journeys.module';
import { LlmModule } from '../llm/llm.module';
import { AgentService } from './agent/agent.service';
import { ConversationStore } from './conversation.store';
import { ComposerTools } from './tools/composer.tools';
import { ToolExecutor } from './tools/tool-executor';
import { ToolRegistry } from './tools/tool-registry';
import { VibeController } from './vibe.controller';

/**
 * Vibe Booking — the AI concierge.
 *
 * The tool registry is the security boundary that replaced the old
 * separate-process + service-key design; see tool-registry.ts.
 */
@Module({
  imports: [
    AuthModule,
    LlmModule,
    CatalogModule,
    AvailabilityModule,
    JourneysModule,
    BookingsModule,
  ],
  controllers: [VibeController],
  providers: [ToolRegistry, ToolExecutor, ComposerTools, ConversationStore, AgentService],
  exports: [ToolRegistry, ToolExecutor, ConversationStore],
})
export class VibeModule {}
