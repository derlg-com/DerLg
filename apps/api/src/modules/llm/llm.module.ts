import { Module } from '@nestjs/common';

import { LlmService } from './llm.service';

@Module({
  providers: [LlmService],
  // The Vibe agent (Task 15) is the only consumer.
  exports: [LlmService],
})
export class LlmModule {}
