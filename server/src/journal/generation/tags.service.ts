import { Injectable, Logger } from '@nestjs/common';
import { AiClientService } from '../../ai/ai-client.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { buildTagExtractionPrompt } from './prompts';

type MomentForTags = {
  id: string;
  text_context?: string | null;
  voice_transcript?: string | null;
  mood?: string | null;
  photos?: Array<{ photo_url: string; storage_path: string }>;
};

interface ExtractedTag {
  tag: string;
  category: string;
  confidence: number;
}

interface DailyTopTag {
  tag: string;
  category: string;
  score: number;
}

const VALID_CATEGORIES = new Set([
  'activity', 'location', 'food', 'social', 'mood',
  'object', 'event', 'hobby', 'work', 'health',
]);

const MAX_TAGS_PER_MOMENT = 5;

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(
    private aiClient: AiClientService,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Extract tags from all moments for a day and compute daily top-3.
   * Returns the top 3 tags for use by the Writer.
   */
  async extractAndAggregate(
    userId: string,
    date: string,
    moments: MomentForTags[],
    signedPhotoUrls: Map<string, string[]>,
  ): Promise<DailyTopTag[]> {
    // Step 1: Extract tags for each moment
    const allTags: Array<ExtractedTag & { moment_id: string }> = [];

    for (const moment of moments) {
      const urls = signedPhotoUrls.get(moment.id) ?? [];
      const tags = await this.extractTagsForMoment(moment, urls);

      for (const tag of tags) {
        allTags.push({ ...tag, moment_id: moment.id });
      }
    }

    // Step 2: Persist raw tags
    if (allTags.length > 0) {
      await this.persistMomentTags(allTags);
    }

    // Step 3: Aggregate daily top-3
    const topTags = this.computeDailyTopTags(allTags);

    // Step 4: Persist daily summary
    await this.persistDailyTagSummary(userId, date, allTags, topTags);

    return topTags;
  }

  private async extractTagsForMoment(
    moment: MomentForTags,
    photoUrls: string[],
  ): Promise<ExtractedTag[]> {
    const client = this.aiClient.getClient('tags');
    if (!client) {
      return this.buildFallbackTags(moment);
    }

    const model = this.aiClient.getModel('tags');
    const prompt = buildTagExtractionPrompt(moment, photoUrls);

    try {
      const imageContents = photoUrls.map((url) => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'low' as const },
      }));

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...imageContents,
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 300,
      });

      const raw = response.choices[0]?.message?.content?.trim();
      if (!raw) return this.buildFallbackTags(moment);

      return this.parseTags(raw);
    } catch (error) {
      if (this.aiClient.isConfigurationError(error)) {
        this.aiClient.disableClient('tags');
      }
      this.logger.warn(
        `Tag extraction failed for moment ${moment.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return this.buildFallbackTags(moment);
    }
  }

  private parseTags(raw: string): ExtractedTag[] {
    try {
      // Strip markdown fences if present
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(
          (t: unknown): t is ExtractedTag =>
            typeof t === 'object' && t !== null &&
            typeof (t as ExtractedTag).tag === 'string' &&
            typeof (t as ExtractedTag).category === 'string' &&
            typeof (t as ExtractedTag).confidence === 'number' &&
            VALID_CATEGORIES.has((t as ExtractedTag).category),
        )
        .map((t) => ({
          tag: t.tag.toLowerCase().slice(0, 50),
          category: t.category,
          confidence: Math.max(0, Math.min(1, t.confidence)),
        }))
        .slice(0, MAX_TAGS_PER_MOMENT);
    } catch {
      this.logger.warn(`Failed to parse tag JSON: ${raw.slice(0, 100)}`);
      return [];
    }
  }

  private buildFallbackTags(moment: MomentForTags): ExtractedTag[] {
    const tags: ExtractedTag[] = [];

    if (moment.mood) {
      tags.push({ tag: moment.mood, category: 'mood', confidence: 0.8 });
    }

    if (moment.text_context) {
      tags.push({ tag: 'note', category: 'activity', confidence: 0.3 });
    }

    if ((moment.photos?.length ?? 0) > 0) {
      tags.push({ tag: 'photo', category: 'object', confidence: 0.3 });
    }

    return tags;
  }

  private computeDailyTopTags(
    allTags: Array<ExtractedTag & { moment_id: string }>,
  ): DailyTopTag[] {
    if (allTags.length === 0) return [];

    // Group by tag
    const tagGroups = new Map<string, { category: string; confidences: number[]; count: number }>();

    for (const t of allTags) {
      const existing = tagGroups.get(t.tag);
      if (existing) {
        existing.confidences.push(t.confidence);
        existing.count += 1;
      } else {
        tagGroups.set(t.tag, {
          category: t.category,
          confidences: [t.confidence],
          count: 1,
        });
      }
    }

    // Score: count × avg_confidence
    const scored: DailyTopTag[] = [];
    for (const [tag, group] of tagGroups) {
      const avgConfidence = group.confidences.reduce((a, b) => a + b, 0) / group.confidences.length;
      scored.push({
        tag,
        category: group.category,
        score: Math.round(group.count * avgConfidence * 100) / 100,
      });
    }

    // Sort descending, take top 3
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3);
  }

  private async persistMomentTags(
    tags: Array<ExtractedTag & { moment_id: string }>,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const rows = tags.map((t) => ({
      moment_id: t.moment_id,
      tag: t.tag,
      category: t.category,
      confidence: t.confidence,
    }));

    const { error } = await supabase
      .from('moment_tags')
      .upsert(rows, { onConflict: 'moment_id,tag' });

    if (error) {
      this.logger.error(`Failed to persist moment tags: ${error.message}`);
      // Non-fatal — don't block journal generation
    }
  }

  private async persistDailyTagSummary(
    userId: string,
    date: string,
    allTags: Array<ExtractedTag & { moment_id: string }>,
    topTags: DailyTopTag[],
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Build full frequency map
    const tagCounts: Record<string, number> = {};
    for (const t of allTags) {
      tagCounts[t.tag] = (tagCounts[t.tag] ?? 0) + 1;
    }

    const { error } = await supabase
      .from('daily_tag_summaries')
      .upsert(
        {
          user_id: userId,
          day_date: date,
          top_tags: topTags,
          tag_counts: tagCounts,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,day_date' },
      );

    if (error) {
      this.logger.error(`Failed to persist daily tag summary: ${error.message}`);
    }
  }
}
