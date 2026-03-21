import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

type ChatCompletionProviderOptions = {
  extra_body?: Record<string, unknown>;
};

@Injectable()
export class OpenaiService {
  private client: OpenAI | null = null;
  private readonly baseURL: string | null;
  private readonly defaultModel: string;
  private readonly visionModel: string;
  private readonly distillationModel: string;
  private readonly transcriptionModel: string;
  private readonly enableThinkingOverride: boolean | undefined;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');

    this.baseURL = baseURL ?? null;

    this.defaultModel = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o');
    this.visionModel = this.configService.get<string>('OPENAI_VISION_MODEL', this.defaultModel);
    this.distillationModel = this.configService.get<string>(
      'OPENAI_DISTILLATION_MODEL',
      this.defaultModel,
    );
    this.transcriptionModel = this.configService.get<string>(
      'OPENAI_TRANSCRIPTION_MODEL',
      this.isDashScopeCompatibleBaseUrl(baseURL) ? 'qwen3-asr-flash' : 'whisper-1',
    );
    this.enableThinkingOverride = this.parseOptionalBoolean(
      this.configService.get<string>('OPENAI_ENABLE_THINKING'),
    );

    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
      });
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

  getChatModel(): string {
    return this.defaultModel;
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

  getChatCompletionProviderOptions(model: string): ChatCompletionProviderOptions {
    const enableThinking = this.getEnableThinkingValue(model);
    if (enableThinking === undefined) {
      return {};
    }

    return {
      extra_body: {
        enable_thinking: enableThinking,
      },
    };
  }

  private getEnableThinkingValue(model: string): boolean | undefined {
    if (this.enableThinkingOverride !== undefined) {
      return this.enableThinkingOverride;
    }

    if (this.isDashScopeCompatible() && this.isQwenModel(model)) {
      return false;
    }

    return undefined;
  }

  private isDashScopeCompatible(): boolean {
    return this.isDashScopeCompatibleBaseUrl(this.baseURL);
  }

  private isDashScopeCompatibleBaseUrl(baseURL: string | null | undefined): boolean {
    return Boolean(baseURL?.includes('dashscope'));
  }

  private isQwenModel(model: string): boolean {
    return model.toLowerCase().startsWith('qwen');
  }

  private parseOptionalBoolean(value: string | undefined): boolean | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }

    return undefined;
  }
}
