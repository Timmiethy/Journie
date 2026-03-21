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
      const transcript = this.usesDashScopeAsr()
        ? await this.transcribeWithDashScopeChatCompletions(file, openai)
        : await this.transcribeWithAudioApi(file, openai);

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

  private async transcribeWithAudioApi(file: Express.Multer.File, openai: ReturnType<OpenaiService['getClientOrThrow']>) {
    const audioBytes = new Uint8Array(file.buffer);
    const audioFile = new File([audioBytes], file.originalname || 'voice-note.webm', {
      type: file.mimetype || 'audio/webm',
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: this.openaiService.getTranscriptionModel(),
    });

    return transcription.text?.trim() ?? '';
  }

  private async transcribeWithDashScopeChatCompletions(
    file: Express.Multer.File,
    openai: ReturnType<OpenaiService['getClientOrThrow']>,
  ) {
    const mimeType = file.mimetype || 'audio/webm';
    const dataUri = `data:${mimeType};base64,${file.buffer.toString('base64')}`;
    const model = this.openaiService.getTranscriptionModel();
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: dataUri,
            },
          },
        ],
      },
    ] as unknown as Array<Record<string, unknown>>;
    const requestBody = {
      model,
      messages: messages as never,
      ...this.openaiService.getChatCompletionProviderOptions(model),
      extra_body: {
        ...this.openaiService.getChatCompletionProviderOptions(model).extra_body,
        asr_options: {
          enable_itn: false,
        },
      },
    } as never;
    const completion = await openai.chat.completions.create(requestBody);

    return completion.choices[0]?.message?.content?.trim() ?? '';
  }

  private usesDashScopeAsr(): boolean {
    return this.openaiService.getTranscriptionModel().toLowerCase().startsWith('qwen3-asr-');
  }
}
