import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type AiTask = 'tags' | 'writer' | 'memory' | 'legacy';

interface ModelConfig {
  client: OpenAI | null;
  model: string;
}

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private openaiClient: OpenAI | null = null;
  private dashscopeClient: OpenAI | null = null;
  private readonly flashModel: string;
  private readonly plusModel: string;

  constructor(private configService: ConfigService) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiKey });
    }

    const dashscopeKey = this.configService.get<string>('DASHSCOPE_API_KEY');
    if (dashscopeKey) {
      this.dashscopeClient = new OpenAI({
        apiKey: dashscopeKey,
        baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      });
    }

    this.flashModel = this.configService.get<string>('QWEN_FLASH_MODEL') || 'qwen2.5-vl-3b-instruct';
    this.plusModel = this.configService.get<string>('QWEN_PLUS_MODEL') || 'qwen-plus-latest';

    this.logger.log(
      `AI clients initialized — OpenAI: ${openaiKey ? 'yes' : 'no'}, DashScope: ${dashscopeKey ? 'yes' : 'no'}`,
    );
  }

  getModelConfig(task: AiTask): ModelConfig {
    switch (task) {
      case 'tags':
        return {
          client: this.dashscopeClient ?? this.openaiClient,
          model: this.dashscopeClient ? this.flashModel : 'gpt-4o',
        };
      case 'writer':
      case 'memory':
        return {
          client: this.dashscopeClient ?? this.openaiClient,
          model: this.dashscopeClient ? this.plusModel : 'gpt-4o',
        };
      case 'legacy':
        return {
          client: this.openaiClient ?? this.dashscopeClient,
          model: this.openaiClient ? 'gpt-4o' : this.plusModel,
        };
    }
  }

  getClient(task: AiTask): OpenAI | null {
    return this.getModelConfig(task).client;
  }

  getModel(task: AiTask): string {
    return this.getModelConfig(task).model;
  }

  isConfigured(task: AiTask): boolean {
    return this.getClient(task) !== null;
  }

  disableClient(task: AiTask): void {
    const config = this.getModelConfig(task);
    if (config.client === this.dashscopeClient) {
      this.dashscopeClient = null;
    } else {
      this.openaiClient = null;
    }
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
