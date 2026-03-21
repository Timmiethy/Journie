import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  private client: OpenAI | null = null;

  private chatModel: string;
  private visionModel: string;
  private distillationModel: string;
  private transcriptionModel: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: this.configService.get<string>('OPENAI_BASE_URL') || undefined,
      });
    }

    this.chatModel = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o');
    this.visionModel = this.configService.get<string>('OPENAI_VISION_MODEL', 'gpt-4o');
    this.distillationModel = this.configService.get<string>('OPENAI_DISTILLATION_MODEL', 'gpt-4o');
    this.transcriptionModel = this.configService.get<string>('OPENAI_TRANSCRIPTION_MODEL', 'whisper-1');
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getClient(): OpenAI | null {
    return this.client;
  }

  getClientOrThrow(): OpenAI {
    if (!this.client) {
      throw new InternalServerErrorException({ error: 'OpenAI is not configured' });
    }

    return this.client;
  }

  disableClient() {
    this.client = null;
  }

  getChatModel(): string {
    return this.chatModel;
  }

  getVisionModel(): string {
    return this.visionModel;
  }

  getDistillationModel(): string {
    return this.distillationModel;
  }

  getTranscriptionModel(): string {
    return this.transcriptionModel;
  }

  isConfigurationError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.message.includes('Incorrect API key') ||
      error.message.includes('invalid_api_key') ||
      error.message.includes('401')
    );
  }
}
