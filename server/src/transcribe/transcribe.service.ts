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

    const openai = this.openaiService.getClient();
    if (!openai) {
      return { transcript: this.buildFallbackTranscript(file) };
    }

    const model = this.openaiService.getTranscriptionModel();

    // Qwen ASR models use chat completions with input_audio content type
    // instead of the standard /v1/audio/transcriptions endpoint
    if (model.startsWith('qwen')) {
      return this.transcribeViaChatCompletions(file, model);
    }

    return this.transcribeViaWhisperEndpoint(file, model);
  }

  private async transcribeViaWhisperEndpoint(
    file: Express.Multer.File,
    model: string,
  ): Promise<{ transcript: string }> {
    try {
      const openai = this.openaiService.getClientOrThrow();

      const audioBytes = new Uint8Array(file.buffer);
      const audioFile = new File([audioBytes], file.originalname || 'voice-note.webm', {
        type: file.mimetype || 'audio/webm',
      });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model,
      });

      const transcript = transcription.text?.trim();
      if (transcript) {
        return { transcript };
      }
    } catch (error) {
      if (this.openaiService.isConfigurationError(error)) {
        this.openaiService.disableClient();
      }
      this.logger.error(
        `Whisper transcription failed for ${file.originalname || 'unknown'}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    return { transcript: this.buildFallbackTranscript(file) };
  }

  private async transcribeViaChatCompletions(
    file: Express.Multer.File,
    model: string,
  ): Promise<{ transcript: string }> {
    try {
      const openai = this.openaiService.getClientOrThrow();

      const mimeType = file.mimetype || 'audio/webm';
      const base64Audio = file.buffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64Audio}`;

      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio' as 'text',
                input_audio: { data: dataUri },
              } as unknown as { type: 'text'; text: string },
            ],
          },
        ],
      });

      const transcript = response.choices[0]?.message?.content?.trim();
      if (transcript) {
        return { transcript };
      }
    } catch (error) {
      if (this.openaiService.isConfigurationError(error)) {
        this.openaiService.disableClient();
      }
      this.logger.error(
        `Chat-based transcription failed for ${file.originalname || 'unknown'}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    return { transcript: this.buildFallbackTranscript(file) };
  }

  private buildFallbackTranscript(file: Express.Multer.File): string {
    return `Voice note captured from ${file.originalname || 'audio clip'}.`;
  }
}
