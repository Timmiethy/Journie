import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { format, addDays } from 'date-fns';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { MemoryService } from './memory.service';
import { AiClientService } from '../../ai/ai-client.service';
import { buildWeeklyTagCurationPrompt, buildWeeklyWriterPrompt } from './prompts';

interface DailyTopTag {
  tag: string;
  category: string;
  score: number;
}

interface DailyInsightRow {
  day_date: string;
  insights: Array<{ text: string; confirmed: boolean }>;
  daily_achievement: string | null;
  best_photo_url: string | null;
}

@Injectable()
export class WeeklyService {
  private readonly logger = new Logger(WeeklyService.name);

  constructor(
    private supabaseService: SupabaseService,
    private memoryService: MemoryService,
    private aiClient: AiClientService,
  ) {}

  /**
   * Generate a weekly summary for the given week (Monday start).
   */
  async generateWeekly(userId: string, weekStart: string): Promise<{ summary_id: string }> {
    const weekEnd = format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd');
    const supabase = this.supabaseService.getClient();

    // Step 1: Collect daily tag summaries for the week
    const { data: tagRows, error: tagError } = await supabase
      .from('daily_tag_summaries')
      .select('top_tags, tag_counts, day_date')
      .eq('user_id', userId)
      .gte('day_date', weekStart)
      .lte('day_date', weekEnd)
      .order('day_date');

    if (tagError) {
      this.logger.error(`Failed to fetch weekly tags: ${tagError.message}`);
      throw tagError;
    }

    // Step 2: Aggregate top 10 tags across the week
    const weeklyTagCounts = new Map<string, { category: string; score: number }>();
    for (const row of tagRows ?? []) {
      const topTags = (row.top_tags ?? []) as DailyTopTag[];
      for (const t of topTags) {
        const existing = weeklyTagCounts.get(t.tag);
        if (existing) {
          existing.score += t.score;
        } else {
          weeklyTagCounts.set(t.tag, { category: t.category, score: t.score });
        }
      }
    }

    const weeklyTop10 = Array.from(weeklyTagCounts.entries())
      .map(([tag, data]) => ({ tag, category: data.category, score: Math.round(data.score * 100) / 100 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Step 3: Curate top 10 → top 3 via strong model
    const curatedTop3 = await this.curateWeeklyTags(weeklyTop10);

    // Step 4: Collect daily journals + insights
    const { data: journals } = await supabase
      .from('journal_entries')
      .select('day_date, content')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .eq('entry_type', 'daily')
      .gte('day_date', weekStart)
      .lte('day_date', weekEnd)
      .order('day_date');

    const { data: insights } = await supabase
      .from('daily_insights')
      .select('day_date, insights, daily_achievement, best_photo_url')
      .eq('user_id', userId)
      .gte('day_date', weekStart)
      .lte('day_date', weekEnd)
      .order('day_date');

    // Step 5: Get user memories
    const memories = await this.memoryService.getMemories(userId);
    const memoryBlock = this.memoryService.formatMemoriesForPrompt(memories);

    // Step 6: Generate weekly summary via Writer
    const dailyJournals = (journals ?? []).map((j) => ({
      date: j.day_date as string,
      content: j.content as string,
    }));

    const dailyInsights = ((insights ?? []) as DailyInsightRow[]).map((i) => ({
      date: i.day_date,
      insights: i.insights ?? [],
    }));

    const summary = await this.generateWeeklySummary(
      curatedTop3,
      dailyJournals,
      dailyInsights,
      memoryBlock,
    );

    // Find best photo from the week
    const bestDailyPhoto = ((insights ?? []) as DailyInsightRow[])
      .map((i) => i.best_photo_url)
      .find((url) => url != null) ?? null;

    // Step 7: Persist weekly summary
    const { data: summaryRow, error: summaryError } = await supabase
      .from('weekly_summaries')
      .upsert(
        {
          user_id: userId,
          week_start: weekStart,
          week_end: weekEnd,
          top_tags: curatedTop3,
          summary,
          best_photo_url: bestDailyPhoto,
          stats: {
            days_with_journals: dailyJournals.length,
            total_insights: dailyInsights.reduce((n, d) => n + d.insights.length, 0),
          },
        },
        { onConflict: 'user_id,week_start' },
      )
      .select()
      .single();

    if (summaryError) {
      this.logger.error(`Failed to persist weekly summary: ${summaryError.message}`);
      throw summaryError;
    }

    // Also persist as a weekly journal entry
    const timestamp = new Date().toISOString();
    await supabase
      .from('journal_entries')
      .upsert(
        {
          user_id: userId,
          day_date: weekStart,
          content: summary,
          generated_content: summary,
          status: 'draft',
          entry_type: 'weekly',
          best_photo_url: bestDailyPhoto,
          daily_achievement: curatedTop3.length > 0
            ? `Weekly focus: ${curatedTop3.map((t) => t.tag).join(', ')}`
            : null,
          generated_at: timestamp,
          updated_at: timestamp,
        },
        { onConflict: 'user_id,day_date' },
      );

    return { summary_id: summaryRow.id };
  }

  private async curateWeeklyTags(
    top10: DailyTopTag[],
  ): Promise<DailyTopTag[]> {
    if (top10.length <= 3) return top10;

    const client = this.aiClient.getClient('writer');
    if (!client) return top10.slice(0, 3);

    const model = this.aiClient.getModel('writer');
    const prompt = buildWeeklyTagCurationPrompt(top10);

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You curate weekly tags to find the most meaningful metrics. Respond ONLY with valid JSON, no markdown fences.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const raw = response.choices[0]?.message?.content?.trim();
      if (!raw) return top10.slice(0, 3);

      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 3) as DailyTopTag[];
      }
    } catch (error) {
      this.logger.warn(`Weekly tag curation failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }

    return top10.slice(0, 3);
  }

  private async generateWeeklySummary(
    curatedTopTags: DailyTopTag[],
    dailyJournals: Array<{ date: string; content: string }>,
    dailyInsights: Array<{ date: string; insights: Array<{ text: string; confirmed: boolean }> }>,
    memoryBlock: string,
  ): Promise<string> {
    const client = this.aiClient.getClient('writer');
    if (!client) {
      return this.buildFallbackWeeklySummary(curatedTopTags, dailyJournals);
    }

    const model = this.aiClient.getModel('writer');
    const prompt = buildWeeklyWriterPrompt(curatedTopTags, dailyJournals, dailyInsights, memoryBlock);

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You write weekly journal summaries. Be warm, insightful, and specific. Reference actual events from the daily journals.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });

      return response.choices[0]?.message?.content?.trim()
        ?? this.buildFallbackWeeklySummary(curatedTopTags, dailyJournals);
    } catch (error) {
      this.logger.warn(`Weekly summary generation failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return this.buildFallbackWeeklySummary(curatedTopTags, dailyJournals);
    }
  }

  private buildFallbackWeeklySummary(
    tags: DailyTopTag[],
    journals: Array<{ date: string; content: string }>,
  ): string {
    const tagList = tags.map((t) => t.tag).join(', ') || 'no tags';
    const dayCount = journals.length;

    return `This week had ${dayCount} journaled day${dayCount !== 1 ? 's' : ''}. ` +
      `The recurring themes were: ${tagList}.\n\n` +
      `📊 **Weekly Stats**\n• 🏷️ Top tags: ${tagList}\n• ✨ Highlight: A week of moments worth keeping.`;
  }
}
