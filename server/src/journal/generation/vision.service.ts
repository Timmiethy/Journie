import { Injectable, Logger } from '@nestjs/common';
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

    const openai = this.openaiService.getClient();
    if (!openai) {
      return this.buildFallbackDescription(photoUrls.length);
    }

    const imageContents = photoUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'low' as const },
    }));

    try {
      const response = await openai.chat.completions.create({
        model: this.openaiService.getVisionModel(),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PHOTO_VISION_PROMPT },
              ...imageContents,
            ],
          },
        ],
        max_tokens: 500,
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      if (this.openaiService.isConfigurationError(error)) {
        this.openaiService.disableClient();
        this.logger.warn(
          `OpenAI vision unavailable, using fallback descriptions for ${photoUrls.length} photo(s).`,
        );
      } else {
        this.logger.error(
          `Photo vision failed for ${photoUrls.length} photo(s): ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
      return this.buildFallbackDescription(photoUrls.length);
    }
  }

  private buildFallbackDescription(photoCount: number): string {
    return photoCount === 1
      ? 'A single photo was captured for this moment.'
      : `${photoCount} photos were captured for this moment.`;
  }
}
