import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  private client: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
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
