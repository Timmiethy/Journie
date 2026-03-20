import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { PersonaModule } from './persona/persona.module';
import { MomentsModule } from './moments/moments.module';
import { TranscribeModule } from './transcribe/transcribe.module';
import { JournalModule } from './journal/journal.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    PersonaModule,
    MomentsModule,
    TranscribeModule,
    JournalModule,
    AiModule,
  ],
})
export class AppModule {}
