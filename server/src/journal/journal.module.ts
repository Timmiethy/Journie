import { Module } from '@nestjs/common';
import { JournalController, JournalsController } from './journal.controller';
import { JournalService } from './journal.service';
import { GenerationService } from './generation/generation.service';
import { TagsService } from './generation/tags.service';
import { MemoryService } from './generation/memory.service';
import { WeeklyService } from './generation/weekly.service';
import { AiModule } from '../ai/ai.module';
import { PersonaModule } from '../persona/persona.module';
import { MomentsModule } from '../moments/moments.module';

@Module({
  imports: [AiModule, PersonaModule, MomentsModule],
  controllers: [JournalController, JournalsController],
  providers: [
    JournalService,
    GenerationService,
    TagsService,
    MemoryService,
    WeeklyService,
  ],
})
export class JournalModule {}
