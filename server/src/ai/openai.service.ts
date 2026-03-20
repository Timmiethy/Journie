import { Injectable } from '@nestjs/common';
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
}
