import { Injectable, Logger } from '@nestjs/common';
import { AiClientService } from '../../ai/ai-client.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { buildMemoryGatingPrompt } from './prompts';

interface Insight {
  text: string;
  confirmed: boolean;
}

interface UserMemoryRow {
  id: string;
  user_id: string;
  category: string;
  fact: string;
  confidence: number;
  source_date: string;
  expires_at: string | null;
}

interface DailyTopTag {
  tag: string;
  category: string;
  score: number;
}

const MEMORY_CAP = 200;

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private aiClient: AiClientService,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Fetch all memories for a user, ordered by confidence descending.
   */
  async getMemories(userId: string): Promise<UserMemoryRow[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .order('confidence', { ascending: false });

    if (error) {
      if (this.isMissingTable(error)) {
        this.logger.warn('user_memories table missing; memory features disabled');
        return [];
      }
      this.logger.error(`Failed to fetch memories for user ${userId}: ${error.message}`);
      return [];
    }

    return (data ?? []) as UserMemoryRow[];
  }

  /**
   * Format memories into a prompt-friendly block for the Writer.
   */
  formatMemoriesForPrompt(memories: UserMemoryRow[]): string {
    if (memories.length === 0) return 'No prior user knowledge yet.';

    const grouped = new Map<string, string[]>();
    for (const m of memories) {
      const cat = m.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(m.fact);
    }

    const blocks: string[] = [];
    for (const [category, facts] of grouped) {
      blocks.push(`[${category.toUpperCase()}]\n${facts.map((f) => `• ${f}`).join('\n')}`);
    }

    return blocks.join('\n\n');
  }

  /**
   * Process daily insights through the memory gating prompt.
   * Only confirmed, significant insights are persisted.
   */
  async processInsights(
    userId: string,
    date: string,
    insights: Insight[],
    dailyTopTags: DailyTopTag[],
  ): Promise<void> {
    const confirmedInsights = insights.filter((i) => i.confirmed);
    if (confirmedInsights.length === 0) {
      this.logger.log(`No confirmed insights for user ${userId}, date ${date}; skipping memory update`);
      return;
    }

    const existingMemories = await this.getMemories(userId);
    const client = this.aiClient.getClient('memory');
    if (!client) {
      this.logger.warn('No AI client for memory gating; skipping');
      return;
    }

    const model = this.aiClient.getModel('memory');
    const prompt = buildMemoryGatingPrompt(
      confirmedInsights,
      dailyTopTags,
      existingMemories.map((m) => ({ category: m.category, fact: m.fact })),
    );

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You evaluate user insights to decide which are significant enough to remember long-term. Respond ONLY with valid JSON, no markdown fences.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 800,
      });

      const raw = response.choices[0]?.message?.content?.trim();
      if (!raw) return;

      const newMemories = this.parseMemoryDecisions(raw);
      if (newMemories.length > 0) {
        await this.persistMemories(userId, date, newMemories, existingMemories.length);
      }
    } catch (error) {
      if (this.aiClient.isConfigurationError(error)) {
        this.aiClient.disableClient('memory');
      }
      this.logger.error(
        `Memory gating failed for user ${userId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  /**
   * Migrate voice profile data into user_memories (one-time or periodic).
   */
  async migrateVoiceProfile(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: profile } = await supabase
      .from('voice_profiles')
      .select('voice_summary, preferred_phrases, avoided_phrases')
      .eq('user_id', userId)
      .single();

    if (!profile?.voice_summary) return;

    const memories: Array<{ category: string; fact: string; confidence: number }> = [];

    if (profile.voice_summary) {
      memories.push({
        category: 'voice',
        fact: `Voice summary: ${profile.voice_summary}`,
        confidence: 0.9,
      });
    }

    if (profile.preferred_phrases?.length > 0) {
      memories.push({
        category: 'voice',
        fact: `Preferred phrases: ${profile.preferred_phrases.join(', ')}`,
        confidence: 0.85,
      });
    }

    if (profile.avoided_phrases?.length > 0) {
      memories.push({
        category: 'voice',
        fact: `Avoided phrases: ${profile.avoided_phrases.join(', ')}`,
        confidence: 0.85,
      });
    }

    const existingCount = (await this.getMemories(userId)).length;
    await this.persistMemories(
      userId,
      new Date().toISOString().slice(0, 10),
      memories,
      existingCount,
    );
  }

  private parseMemoryDecisions(
    raw: string,
  ): Array<{ category: string; fact: string; confidence: number }> {
    try {
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) return [];

      const validCategories = new Set([
        'preference', 'relationship', 'routine', 'identity', 'voice',
      ]);

      return parsed
        .filter(
          (m: unknown): m is { category: string; fact: string; confidence: number } =>
            typeof m === 'object' && m !== null &&
            typeof (m as Record<string, unknown>).category === 'string' &&
            typeof (m as Record<string, unknown>).fact === 'string' &&
            typeof (m as Record<string, unknown>).confidence === 'number' &&
            validCategories.has((m as Record<string, unknown>).category as string),
        )
        .map((m) => ({
          category: m.category,
          fact: m.fact.slice(0, 500),
          confidence: Math.max(0, Math.min(1, m.confidence)),
        }));
    } catch {
      this.logger.warn(`Failed to parse memory decisions: ${raw.slice(0, 100)}`);
      return [];
    }
  }

  private async persistMemories(
    userId: string,
    date: string,
    newMemories: Array<{ category: string; fact: string; confidence: number }>,
    existingCount: number,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Enforce cap: evict lowest-confidence if we'd exceed
    const overflow = existingCount + newMemories.length - MEMORY_CAP;
    if (overflow > 0) {
      await this.evictLowestConfidence(userId, overflow);
    }

    const rows = newMemories.map((m) => ({
      user_id: userId,
      category: m.category,
      fact: m.fact,
      confidence: m.confidence,
      source_date: date,
    }));

    // Upsert based on user_id + md5(fact) unique index
    const { error } = await supabase.from('user_memories').upsert(rows, {
      onConflict: 'user_id,md5(fact)',
      ignoreDuplicates: false,
    });

    if (error) {
      // md5 function in onConflict may not work via supabase-js;
      // fall back to insert with ignore
      for (const row of rows) {
        const { error: insertErr } = await supabase
          .from('user_memories')
          .insert(row);

        if (insertErr && !insertErr.message.includes('duplicate')) {
          this.logger.error(`Failed to persist memory: ${insertErr.message}`);
        }
      }
    }

    this.logger.log(
      `Persisted ${newMemories.length} memories for user ${userId} (date: ${date})`,
    );
  }

  private async evictLowestConfidence(userId: string, count: number): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Get the IDs of the lowest-confidence memories
    const { data, error } = await supabase
      .from('user_memories')
      .select('id')
      .eq('user_id', userId)
      .order('confidence', { ascending: true })
      .limit(count);

    if (error || !data || data.length === 0) return;

    const ids = data.map((r) => r.id);
    await supabase.from('user_memories').delete().in('id', ids);

    this.logger.log(`Evicted ${ids.length} low-confidence memories for user ${userId}`);
  }

  private isMissingTable(error: unknown): boolean {
    const message = error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '').toLowerCase()
        : '';
    return (
      message.includes('user_memories') &&
      (message.includes('does not exist') || message.includes('schema cache'))
    );
  }
}
