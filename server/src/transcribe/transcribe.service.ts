import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
      const openai = this.openaiService.getClient();
      if (!openai) {
        return { transcript: this.buildFallbackTranscript(file) };
      }

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
      if (this.openaiService.isConfigurationError(error)) {
        this.openaiService.disableClient();
        this.logger.warn(
          `OpenAI transcription unavailable, using fallback transcript for ${file.originalname || 'unknown'}.`,
        );
        return { transcript: this.buildFallbackTranscript(file) };
      }

      this.logger.error(
        `Transcription failed for file ${file.originalname || 'unknown'}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return { transcript: this.buildFallbackTranscript(file) };
    }

    return { transcript: this.buildFallbackTranscript(file) };
  }

  private buildFallbackTranscript(file: Express.Multer.File): string {
    return `Voice note captured from ${file.originalname || 'audio clip'}.`;
  }
}
