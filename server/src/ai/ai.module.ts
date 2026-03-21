import { Module } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { AiClientService } from './ai-client.service';

@Module({
  providers: [OpenaiService, AiClientService],
  exports: [OpenaiService, AiClientService],
})
export class AiModule {}
