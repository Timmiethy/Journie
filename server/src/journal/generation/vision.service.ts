import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../../ai/openai.service';
import { PHOTO_VISION_PROMPT } from './prompts';

@Injectable()
export class VisionService {
  constructor(private openaiService: OpenaiService) {}

  async describePhotos(photoUrls: string[]): Promise<string> {
    if (photoUrls.length === 0) return 'No photos provided.';

    const openai = this.openaiService.getClient();

    const imageContents = photoUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'low' as const },
    }));

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
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
  }
}
