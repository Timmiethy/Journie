import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../ai/openai.service';

@Injectable()
export class TranscribeService {
  constructor(private openaiService: OpenaiService) {}

  async transcribe(_file: Express.Multer.File): Promise<{ transcript: string }> {
    // TODO: Forward audio to OpenAI Whisper API
    // const openai = this.openaiService.getClient();
    // const transcription = await openai.audio.transcriptions.create({
    //   file: ...,
    //   model: 'whisper-1',
    // });
    return { transcript: '' };
  }
}
