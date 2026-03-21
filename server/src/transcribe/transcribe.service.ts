import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { OpenaiService } from '../ai/openai.service';

@Injectable()
export class TranscribeService {
  private readonly logger = new Logger(TranscribeService.name);

  constructor(private openaiService: OpenaiService) {}

  async transcribe(file: Express.Multer.File): Promise<{ transcript: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ error: 'Audio file is required' });
    }

    try {
      const openai = this.openaiService.getClientOrThrow();

      const audioBytes = new Uint8Array(file.buffer);
      const audioFile = new File([audioBytes], file.originalname || 'voice-note.webm', {
        type: file.mimetype || 'audio/webm',
      });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
      });

      const transcript = transcription.text?.trim();
      if (transcript) {
        return { transcript };
      }
    } catch (error) {
      this.logger.error(
        `Transcription failed for file ${file.originalname || 'unknown'}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new InternalServerErrorException({ error: 'Transcription failed' });
    }

    throw new InternalServerErrorException({ error: 'Transcription failed' });
  }
}
