import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { OpenaiService } from '../../ai/openai.service';

interface VoiceProfileRow {
  id: string;
  user_id: string;
  voice_summary: string;
  preferred_phrases: string[];
  avoided_phrases: string[];
  journals_analyzed: number;
  last_refreshed_at: string | null;
}

interface EditDiff {
  generated_content: string;
  content: string;
  day_date: string;
}

interface ParsedVoiceProfile {
  voice_summary: string;
  preferred_phrases: string[];
  avoided_phrases: string[];
}

const REFRESH_EVERY_N_JOURNALS = 5;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

function isMissingSchemaObject(error: unknown, objectName: string): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const target = objectName.toLowerCase();

  return (
    message.includes(target) &&
    (
      message.includes('does not exist') ||
      message.includes('could not find') ||
      message.includes('schema cache')
    )
  );
}

@Injectable()
export class VoiceProfileService {
  private readonly logger = new Logger(VoiceProfileService.name);

  constructor(
    private supabaseService: SupabaseService,
    private openaiService: OpenaiService,
  ) {}

  async getProfile(userId: string): Promise<VoiceProfileRow | null> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      return null;
    }
    if (error && isMissingSchemaObject(error, 'voice_profiles')) {
      this.logger.warn('voice_profiles table is missing; voice profile features are disabled until the migration is applied');
      return null;
    }
    if (error) throw error;
    return data;
  }

  /**
   * Check if enough new journals have been confirmed since the last refresh.
   * If so, trigger a voice profile refresh in the background.
   */
  async maybeRefreshProfile(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { count, error } = await supabase
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'confirmed');

    if (error) {
      this.logger.error(`Failed to count confirmed journals for user ${userId}: ${error.message}`);
      return;
    }

    const confirmedCount = count ?? 0;
    const profile = await this.getProfile(userId);
    const analyzedCount = profile?.journals_analyzed ?? 0;

    if (confirmedCount - analyzedCount >= REFRESH_EVERY_N_JOURNALS) {
      // Run refresh without awaiting — don't block journal generation
      this.refreshProfile(userId, confirmedCount).catch((err) => {
        this.logger.error(
          `Voice profile refresh failed for user ${userId}: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      });
    }
  }

  /**
   * Fetch recent confirmed journals and edit diffs, then run an LLM call
   * to distill them into an updated voice summary + phrase lists.
   */
  async refreshProfile(userId: string, confirmedCount: number): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Fetch recent confirmed journals for voice analysis
    let journals:
      | Array<{ content: string; generated_content?: string | null; day_date: string }>
      | null = null;

    let journalsError: unknown = null;

    const journalsWithGeneratedContent = await supabase
      .from('journal_entries')
      .select('content, generated_content, day_date')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .order('day_date', { ascending: false })
      .limit(10);

    if (journalsWithGeneratedContent.error && isMissingSchemaObject(journalsWithGeneratedContent.error, 'generated_content')) {
      this.logger.warn('journal_entries.generated_content is missing; edit-diff voice learning is disabled until the migration is applied');
      const fallbackJournals = await supabase
        .from('journal_entries')
        .select('content, day_date')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .order('day_date', { ascending: false })
        .limit(10);

      journals = (fallbackJournals.data ?? []) as Array<{ content: string; day_date: string }>;
      journalsError = fallbackJournals.error;
    } else {
      journals = journalsWithGeneratedContent.data as Array<{ content: string; generated_content?: string | null; day_date: string }> | null;
      journalsError = journalsWithGeneratedContent.error;
    }

    if (journalsError) throw journalsError;
    if (!journals || journals.length === 0) return;

    // Separate journals into those with edits and those without
    const editDiffs: EditDiff[] = [];
    const confirmedTexts: string[] = [];

    for (const journal of journals) {
      confirmedTexts.push(journal.content);
      if (
        journal.generated_content &&
        journal.content !== journal.generated_content
      ) {
        editDiffs.push({
          generated_content: journal.generated_content,
          content: journal.content,
          day_date: journal.day_date,
        });
      }
    }

    // Get existing profile for continuity
    const existingProfile = await this.getProfile(userId);

    const distillationPrompt = this.buildDistillationPrompt(
      confirmedTexts,
      editDiffs,
      existingProfile,
    );

    const openai = this.openaiService.getClient();
    if (!openai) {
      this.logger.warn('OpenAI not configured, skipping voice profile refresh');
      return;
    }

    const model = this.openaiService.getDistillationModel();
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You analyze journal entries to extract a writer\'s unique voice profile. Respond ONLY with valid JSON, no markdown fences.' },
        { role: 'user', content: distillationPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      ...this.openaiService.getChatCompletionProviderOptions(model),
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      this.logger.error(`Empty distillation response for user ${userId}`);
      return;
    }

    const parsed = this.parseVoiceProfileResponse(raw);
    if (!parsed) {
      this.logger.error(`Failed to parse distillation response for user ${userId}: ${raw.slice(0, 200)}`);
      return;
    }

    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from('voice_profiles')
      .upsert(
        {
          user_id: userId,
          voice_summary: parsed.voice_summary || '',
          preferred_phrases: parsed.preferred_phrases || [],
          avoided_phrases: parsed.avoided_phrases || [],
          journals_analyzed: confirmedCount,
          last_refreshed_at: timestamp,
          updated_at: timestamp,
        },
        { onConflict: 'user_id' },
      );

    if (error && isMissingSchemaObject(error, 'voice_profiles')) {
      this.logger.warn('voice_profiles table is missing; skipping voice profile persistence until the migration is applied');
      return;
    }
    if (error) {
      this.logger.error(`Failed to save voice profile for user ${userId}: ${error.message}`);
      throw error;
    }

    this.logger.log(`Voice profile refreshed for user ${userId} (${confirmedCount} journals analyzed)`);
  }

  /**
   * Fetch recent edit diffs to inject into the generation prompt.
   * Returns the 3 most recent entries where the user edited the AI's output.
   */
  async getRecentEditDiffs(userId: string): Promise<EditDiff[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('content, generated_content, day_date')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .not('generated_content', 'is', null)
      .order('day_date', { ascending: false })
      .limit(5);

    if (error) {
      if (isMissingSchemaObject(error, 'generated_content')) {
        this.logger.warn('journal_entries.generated_content is missing; edit-diff prompt injection is disabled until the migration is applied');
        return [];
      }
      this.logger.error(`Failed to fetch edit diffs for user ${userId}: ${error.message}`);
      return [];
    }

    // Only return entries where the user actually changed something
    return (data ?? []).filter(
      (entry) => entry.generated_content && entry.content !== entry.generated_content,
    ).slice(0, 3);
  }

  /**
   * Format edit diffs into a prompt-friendly block.
   */
  formatEditDiffsForPrompt(diffs: EditDiff[]): string {
    if (diffs.length === 0) return '';

    const blocks = diffs.map((diff) => {
      const aiExcerpt = diff.generated_content.trim().split(/\s+/).slice(0, 60).join(' ');
      const userExcerpt = diff.content.trim().split(/\s+/).slice(0, 60).join(' ');
      return `[${diff.day_date}]\nAI wrote: "${aiExcerpt}..."\nUser changed to: "${userExcerpt}..."`;
    });

    return blocks.join('\n\n');
  }

  /**
   * Format the voice profile into a prompt-friendly block.
   */
  formatProfileForPrompt(profile: VoiceProfileRow | null): string {
    if (!profile || !profile.voice_summary) return '';

    const parts: string[] = [profile.voice_summary];

    if (profile.preferred_phrases.length > 0) {
      parts.push(`\nPhrases and words they naturally use: ${profile.preferred_phrases.join(', ')}`);
    }
    if (profile.avoided_phrases.length > 0) {
      parts.push(`Phrases and words to AVOID (the user dislikes these): ${profile.avoided_phrases.join(', ')}`);
    }

    return parts.join('\n');
  }

  private parseVoiceProfileResponse(raw: string): ParsedVoiceProfile | null {
    const candidates = [raw, this.stripMarkdownCodeFence(raw), this.extractFirstJsonObject(raw)].filter(
      (value): value is string => Boolean(value),
    );

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as ParsedVoiceProfile;
      } catch {
        continue;
      }
    }

    return null;
  }

  private stripMarkdownCodeFence(raw: string): string | null {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    return match?.[1]?.trim() || null;
  }

  private extractFirstJsonObject(raw: string): string | null {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    return raw.slice(start, end + 1).trim();
  }

  private buildDistillationPrompt(
    confirmedTexts: string[],
    editDiffs: EditDiff[],
    existingProfile: VoiceProfileRow | null,
  ): string {
    const journalBlock = confirmedTexts
      .map((text, i) => `[Journal ${i + 1}]\n${text.trim().split(/\s+/).slice(0, 150).join(' ')}`)
      .join('\n\n');

    let editBlock = '';
    if (editDiffs.length > 0) {
      editBlock = '\n\nEDIT HISTORY (what the user changed from AI-generated drafts):\n' +
        editDiffs.map((diff) => {
          return `[${diff.day_date}]\nAI original: "${diff.generated_content.trim().split(/\s+/).slice(0, 80).join(' ')}"\nUser's version: "${diff.content.trim().split(/\s+/).slice(0, 80).join(' ')}"`;
        }).join('\n\n');
    }

    let existingBlock = '';
    if (existingProfile?.voice_summary) {
      existingBlock = `\n\nPREVIOUS VOICE PROFILE (build on this, update what's changed):\n${existingProfile.voice_summary}`;
    }

    return `Analyze these confirmed journal entries (written/edited by the user) and extract their unique writing voice.
${existingBlock}

RECENT JOURNALS:
${journalBlock}
${editBlock}

Respond with a JSON object containing:
1. "voice_summary" (string, 100-200 words): A concise profile of this person's writing voice. Include:
   - Sentence structure patterns (short/long, fragments, run-ons)
   - Emotional expression style (understated, dramatic, ironic)
   - Recurring themes or perspectives
   - Tone and register (formal, conversational, stream-of-consciousness)
   - Any distinctive quirks (code-switching, specific slang, cultural references)

2. "preferred_phrases" (string[], max 15): Specific words, phrases, or expressions the user naturally uses or consistently keeps. Include slang, filler words, and characteristic expressions.

3. "avoided_phrases" (string[], max 10): Words or phrases the user consistently removes or replaces when editing AI drafts. Only include if there's clear evidence from the edit history.`;
  }
}
