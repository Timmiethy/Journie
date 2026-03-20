import { Module } from '@nestjs/common';
import { JournalController, JournalsController } from './journal.controller';
import { JournalService } from './journal.service';
import { GenerationService } from './generation/generation.service';
import { VisionService } from './generation/vision.service';
import { AiModule } from '../ai/ai.module';
import { PersonaModule } from '../persona/persona.module';
import { MomentsModule } from '../moments/moments.module';

@Module({
  imports: [AiModule, PersonaModule, MomentsModule],
  controllers: [JournalController, JournalsController],
  providers: [JournalService, GenerationService, VisionService],
})
export class JournalModule {}
