import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { OpenaiService } from '../../ai/openai.service';
import { PHOTO_VISION_PROMPT } from './prompts';

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);

  constructor(private openaiService: OpenaiService) {}

  async describePhotos(photoUrls: string[]): Promise<string> {
    if (photoUrls.length === 0) {
      return 'No photos provided.';
    }

    const openai = this.openaiService.getClientOrThrow();

    const imageContents = photoUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'low' as const },
    }));

    try {
      const startedAt = Date.now();
      const model = this.openaiService.getVisionModel();
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PHOTO_VISION_PROMPT },
              ...imageContents,
            ],
          },
        ],
        max_tokens: 180,
        ...this.openaiService.getChatCompletionProviderOptions(model),
      });
      this.logger.log(
        `Vision described ${photoUrls.length} photo(s) in ${Date.now() - startedAt}ms using ${model}`,
      );

      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      this.logger.error(
        `Photo vision failed for ${photoUrls.length} photo(s): ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new InternalServerErrorException({ error: 'Photo analysis failed' });
    }
  }
}
