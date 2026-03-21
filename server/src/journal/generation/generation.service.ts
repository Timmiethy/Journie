import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { format } from 'date-fns';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { PersonaService } from '../../persona/persona.service';
import { MomentsService } from '../../moments/moments.service';
import { TagsService } from './tags.service';
import { MemoryService } from './memory.service';
import { AiClientService } from '../../ai/ai-client.service';
import { buildWriterSystemPrompt, buildWriterUserMessage } from './prompts';

type NarrativeVoice = 'first_person' | 'second_person' | 'third_person';

type MomentLike = {
  id: string;
  text_context?: string | null;
  voice_transcript?: string | null;
  mood?: string | null;
  captured_at: string;
  photos?: Array<{ id?: string; photo_url: string; storage_path: string; order_index?: number }>;
};

type PersonaLike = {
  writing_style: string;
  journal_topics: string[];
  narrative_voice: string;
  emotional_depth: string;
  personality_tags: string[];
  mbti: string | null;
  occupation: string | null;
  daily_people: string[];
  daily_activities: string[];
  additional_context: string | null;
};

type JournalLike = {
  content: string;
  generated_content?: string | null;
};

interface ParsedWriterOutput {
  journalBody: string;
  dailyAchievement: string | null;
  bestPhotoRef: string | null;
  insights: Array<{ text: string; confirmed: boolean }>;
}

interface EditDiff {
  generated_content: string;
  content: string;
  day_date: string;
}

const FREE_USER_IMAGE_CAP = 10;

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
export class GenerationService {
  private static readonly failureContent = 'Generation failed — tap Regenerate to try again.';
  private static readonly generationAttempts = new Map<string, number[]>();
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private supabaseService: SupabaseService,
    private personaService: PersonaService,
    private momentsService: MomentsService,
    private tagsService: TagsService,
    private memoryService: MemoryService,
    private aiClient: AiClientService,
  ) {}

  async generate(userId: string, date: string, regenerate = false, momentIds?: string[]) {
    this.enforceRateLimit(userId, date);

    const supabase = this.supabaseService.getClient();

    const timestamp = new Date().toISOString();
    const { data: journal, error: journalError } = await supabase
      .from('journal_entries')
      .upsert(
        {
          user_id: userId,
          day_date: date,
          status: 'generating',
          entry_type: 'daily',
          updated_at: timestamp,
          ...(regenerate ? {} : { created_at: timestamp }),
        },
        { onConflict: 'user_id,day_date' },
      )
      .select()
      .single();

    if (journalError) {
      this.logger.error(
        `Failed to create generating journal row for user ${userId}, date ${date}: ${journalError.message}`,
      );
      throw journalError;
    }

    void this.runGenerationPipeline(userId, date, regenerate, momentIds);

    return { journal_id: journal.id, status: 'generating' };
  }

  // ─── Tri-model pipeline: Tags → Writer → Memory ───

  private async runGenerationPipeline(
    userId: string,
    date: string,
    regenerate: boolean,
    momentIds?: string[],
  ) {
    try {
      // Step 1: Gather context (parallel)
      const [persona, moments, recentJournals, memories, editDiffs] = await Promise.all([
        this.personaService.findByUserId(userId),
        this.momentsService.findByDate(userId, date),
        this.fetchRecentJournals(userId, date),
        this.memoryService.getMemories(userId),
        this.fetchRecentEditDiffs(userId),
      ]);

      const orderedMoments = this.orderMomentsByIds(moments as MomentLike[], momentIds);

      if (!persona) {
        throw new BadRequestException({ error: 'Persona not found' });
      }

      // Step 2: Sign photo URLs for all moments
      const signedPhotoUrls = new Map<string, string[]>();
      for (const moment of orderedMoments) {
        const urls = await this.getSignedPhotoUrls(moment.photos ?? []);
        signedPhotoUrls.set(moment.id, urls);
      }

      // Step 3: TAGS — Extract and aggregate (Qwen 2.5 Flash)
      const dailyTopTags = await this.tagsService.extractAndAggregate(
        userId,
        date,
        orderedMoments as MomentLike[],
        signedPhotoUrls,
      );

      // Step 4: WRITER — Generate journal + insights (Qwen 3.5 Plus)
      // Collect all photo URLs (capped for free users)
      const allPhotoUrls = this.collectPhotoUrls(orderedMoments, signedPhotoUrls);

      const memoryBlock = this.memoryService.formatMemoriesForPrompt(memories);
      const editDiffsBlock = this.formatEditDiffsForPrompt(editDiffs);

      const systemPrompt = buildWriterSystemPrompt(
        persona as PersonaLike,
        memoryBlock,
        this.buildRecentJournalExcerptBlock(recentJournals),
        editDiffsBlock,
      );

      const describedMoments = orderedMoments.map((moment, index) => ({
        index,
        time: format(new Date(moment.captured_at), 'h:mm a'),
        mood: (moment as MomentLike).mood ?? null,
        photoUrls: signedPhotoUrls.get(moment.id) ?? [],
        notes: this.combineNotes(moment as MomentLike),
      }));

      const userMessage = buildWriterUserMessage(
        describedMoments,
        format(new Date(`${date}T12:00:00`), 'EEEE, MMMM d, yyyy'),
        dailyTopTags,
      );

      const writerOutput = await this.runWriter(
        date,
        persona as PersonaLike,
        describedMoments,
        allPhotoUrls,
        systemPrompt,
        userMessage,
      );

      // Step 5: Persist journal + insights
      const bestPhotoUrl = this.resolveBestPhotoUrl(
        writerOutput.bestPhotoRef,
        orderedMoments,
        signedPhotoUrls,
      );

      await this.updateGeneratedJournal(
        userId,
        date,
        writerOutput.journalBody,
        writerOutput.dailyAchievement,
        bestPhotoUrl,
        regenerate,
      );

      await this.persistDailyInsights(
        userId,
        date,
        writerOutput.insights,
        writerOutput.dailyAchievement,
        bestPhotoUrl,
      );

      // Step 6: MEMORY — Process insights (non-blocking)
      this.memoryService
        .processInsights(userId, date, writerOutput.insights, dailyTopTags)
        .catch((err) => {
          this.logger.error(
            `Memory processing failed for user ${userId}: ${err instanceof Error ? err.message : 'unknown'}`,
          );
        });
    } catch (error) {
      await this.markGenerationFailure(userId, date, regenerate);
      this.logger.error(
        `Journal generation failed for user ${userId}, date ${date}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  // ─── Writer (Qwen 3.5 Plus with direct image processing) ───

  private async runWriter(
    date: string,
    persona: PersonaLike,
    describedMoments: Array<{
      index: number;
      time: string;
      mood: string | null;
      photoUrls: string[];
      notes: string | null;
    }>,
    allPhotoUrls: string[],
    systemPrompt: string,
    userMessage: string,
  ): Promise<ParsedWriterOutput> {
    const client = this.aiClient.getClient('writer');
    if (!client) {
      const fallbackBody = this.buildFallbackJournal(date, persona, describedMoments);
      return {
        journalBody: fallbackBody,
        dailyAchievement: null,
        bestPhotoRef: null,
        insights: [],
      };
    }

    const model = this.aiClient.getModel('writer');

    try {
      // Build multimodal content: text + images
      const userContent: Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string; detail: 'low' | 'high' } }
      > = [{ type: 'text', text: userMessage }];

      // Attach photos directly for the model to reason about
      for (const url of allPhotoUrls) {
        userContent.push({
          type: 'image_url',
          image_url: { url, detail: 'low' },
        });
      }

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        return {
          journalBody: this.buildFallbackJournal(date, persona, describedMoments),
          dailyAchievement: null,
          bestPhotoRef: null,
          insights: [],
        };
      }

      return this.parseWriterOutput(raw);
    } catch (error) {
      if (this.aiClient.isConfigurationError(error)) {
        this.aiClient.disableClient('writer');
      }
      this.logger.warn(
        `Writer failed for ${date}, using fallback: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return {
        journalBody: this.buildFallbackJournal(date, persona, describedMoments),
        dailyAchievement: null,
        bestPhotoRef: null,
        insights: [],
      };
    }
  }

  // ─── Output parsing ───

  private parseWriterOutput(raw: string): ParsedWriterOutput {
    // Extract <daily_achievement>
    const achievementMatch = raw.match(/<daily_achievement>(.*?)<\/daily_achievement>/s);
    let dailyAchievement = achievementMatch?.[1]?.trim() ?? null;
    if (dailyAchievement && dailyAchievement.split(/\s+/).length > 10) {
      dailyAchievement = dailyAchievement.split(/\s+/).slice(0, 10).join(' ');
    }

    // Extract <best_photo>
    const bestPhotoMatch = raw.match(/<best_photo>(.*?)<\/best_photo>/s);
    const bestPhotoRef = bestPhotoMatch?.[1]?.trim() ?? null;

    // Extract <Insights>
    const insightsMatch = raw.match(/<Insights>(.*?)<\/Insights>/s);
    const insights: Array<{ text: string; confirmed: boolean }> = [];

    if (insightsMatch?.[1]) {
      const lines = insightsMatch[1].trim().split('\n').filter((l) => l.trim().startsWith('-'));
      for (const line of lines) {
        const text = line.replace(/^-\s*/, '').trim();
        const confirmed = text.includes('[CONFIRMED]');
        insights.push({
          text: text.replace(/\[(CONFIRMED|UNCONFIRMED)\]\s*/g, '').trim(),
          confirmed,
        });
      }
    }

    // Journal body = everything before the first structured tag
    let journalBody = raw;
    for (const tag of ['<daily_achievement>', '<best_photo>', '<Insights>']) {
      const idx = journalBody.indexOf(tag);
      if (idx !== -1) {
        journalBody = journalBody.slice(0, idx);
      }
    }
    journalBody = journalBody.trim();

    return { journalBody, dailyAchievement, bestPhotoRef, insights };
  }

  // ─── Photo URL helpers ───

  private collectPhotoUrls(
    moments: MomentLike[],
    signedPhotoUrls: Map<string, string[]>,
  ): string[] {
    const allUrls: string[] = [];
    for (const moment of moments) {
      const urls = signedPhotoUrls.get(moment.id) ?? [];
      allUrls.push(...urls);
    }
    // Cap for free users
    return allUrls.slice(0, FREE_USER_IMAGE_CAP);
  }

  private resolveBestPhotoUrl(
    bestPhotoRef: string | null,
    moments: MomentLike[],
    signedPhotoUrls: Map<string, string[]>,
  ): string | null {
    if (!bestPhotoRef) {
      // Default: first photo of first moment
      for (const moment of moments) {
        const urls = signedPhotoUrls.get(moment.id);
        if (urls && urls.length > 0) return urls[0];
      }
      return null;
    }

    // Try to match by index (e.g. "0", "1", "2")
    const idx = parseInt(bestPhotoRef, 10);
    if (!isNaN(idx)) {
      const allUrls = this.collectPhotoUrls(moments, signedPhotoUrls);
      if (idx >= 0 && idx < allUrls.length) return allUrls[idx];
    }

    // Try to match by moment photo ID
    for (const moment of moments) {
      for (const photo of moment.photos ?? []) {
        if (photo.id === bestPhotoRef) {
          const urls = signedPhotoUrls.get(moment.id);
          const photoIdx = moment.photos?.findIndex((p) => p.id === bestPhotoRef) ?? -1;
          if (urls && photoIdx >= 0 && photoIdx < urls.length) return urls[photoIdx];
        }
      }
    }

    // Fallback: first photo
    for (const moment of moments) {
      const urls = signedPhotoUrls.get(moment.id);
      if (urls && urls.length > 0) return urls[0];
    }
    return null;
  }

  private async getSignedPhotoUrls(
    photos: Array<{ photo_url: string; storage_path: string }>,
  ): Promise<string[]> {
    if (photos.length === 0) return [];

    const supabase = this.supabaseService.getClient();
    const signedUrls: string[] = [];

    for (const photo of photos) {
      if (!photo.storage_path) {
        if (photo.photo_url) {
          signedUrls.push(photo.photo_url);
          continue;
        }
        this.logger.warn('Skipping photo without storage_path and photo_url during generation.');
        continue;
      }

      const { data, error } = await supabase.storage
        .from('moment-photos')
        .createSignedUrl(photo.storage_path, 60 * 60);

      if (error || !data?.signedUrl) {
        if (photo.photo_url) {
          this.logger.warn(
            `Falling back to stored photo_url for ${photo.storage_path}: ${error?.message ?? 'missing signed URL'}`,
          );
          signedUrls.push(photo.photo_url);
          continue;
        }
        this.logger.error(
          `Failed to sign photo ${photo.storage_path}: ${error?.message ?? 'missing signed URL'}`,
        );
        throw new InternalServerErrorException({ error: 'Photo analysis failed' });
      }

      signedUrls.push(data.signedUrl);
    }

    return signedUrls;
  }

  // ─── Persistence helpers ───

  private async updateGeneratedJournal(
    userId: string,
    date: string,
    content: string,
    dailyAchievement: string | null,
    bestPhotoUrl: string | null,
    regenerate: boolean,
  ) {
    const supabase = this.supabaseService.getClient();
    const timestamp = new Date().toISOString();

    let { error } = await supabase
      .from('journal_entries')
      .upsert(
        {
          user_id: userId,
          day_date: date,
          content,
          generated_content: content,
          status: 'draft',
          entry_type: 'daily',
          daily_achievement: dailyAchievement,
          best_photo_url: bestPhotoUrl,
          generated_at: timestamp,
          confirmed_at: null,
          updated_at: timestamp,
          ...(regenerate ? {} : { created_at: timestamp }),
        },
        { onConflict: 'user_id,day_date' },
      );

    if (error && isMissingSchemaObject(error, 'generated_content')) {
      this.logger.warn('journal_entries.generated_content is missing; preserving original AI output is disabled');
      const fallback = await supabase
        .from('journal_entries')
        .upsert(
          {
            user_id: userId,
            day_date: date,
            content,
            status: 'draft',
            entry_type: 'daily',
            generated_at: timestamp,
            confirmed_at: null,
            updated_at: timestamp,
            ...(regenerate ? {} : { created_at: timestamp }),
          },
          { onConflict: 'user_id,day_date' },
        );
      error = fallback.error;
    }

    if (error) {
      this.logger.error(
        `Failed to update generated journal for user ${userId}, date ${date}: ${error.message}`,
      );
      throw error;
    }
  }

  private async persistDailyInsights(
    userId: string,
    date: string,
    insights: Array<{ text: string; confirmed: boolean }>,
    dailyAchievement: string | null,
    bestPhotoUrl: string | null,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('daily_insights')
      .upsert(
        {
          user_id: userId,
          day_date: date,
          insights,
          daily_achievement: dailyAchievement,
          best_photo_url: bestPhotoUrl,
        },
        { onConflict: 'user_id,day_date' },
      );

    if (error) {
      this.logger.warn(`Failed to persist daily insights: ${error.message}`);
      // Non-fatal
    }
  }

  private async markGenerationFailure(userId: string, date: string, regenerate: boolean) {
    const supabase = this.supabaseService.getClient();
    const timestamp = new Date().toISOString();

    await supabase
      .from('journal_entries')
      .upsert(
        {
          user_id: userId,
          day_date: date,
          content: GenerationService.failureContent,
          status: 'draft',
          entry_type: 'daily',
          generated_at: timestamp,
          updated_at: timestamp,
          ...(regenerate ? {} : { created_at: timestamp }),
        },
        { onConflict: 'user_id,day_date' },
      );
  }

  // ─── Context fetching ───

  private async fetchRecentJournals(userId: string, date: string): Promise<JournalLike[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('content')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .lt('day_date', date)
      .order('day_date', { ascending: false })
      .limit(7);

    if (error) {
      this.logger.error(
        `Failed to fetch recent journals for user ${userId}, date ${date}: ${error.message}`,
      );
      throw error;
    }

    return (data ?? []) as JournalLike[];
  }

  private async fetchRecentEditDiffs(userId: string): Promise<EditDiff[]> {
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
        this.logger.warn('generated_content missing; edit-diff disabled');
        return [];
      }
      this.logger.error(`Failed to fetch edit diffs: ${error.message}`);
      return [];
    }

    return (data ?? [])
      .filter((e) => e.generated_content && e.content !== e.generated_content)
      .slice(0, 3) as EditDiff[];
  }

  // ─── Formatting helpers ───

  private buildRecentJournalExcerptBlock(journals: JournalLike[]): string {
    if (journals.length === 0) return 'No previous journals yet.';

    return journals
      .map((journal, index) => `[Journal ${index + 1}] ${this.firstWords(journal.content, 150)}`)
      .join('\n\n');
  }

  private formatEditDiffsForPrompt(diffs: EditDiff[]): string {
    if (diffs.length === 0) return '';

    return diffs
      .map((diff) => {
        const aiExcerpt = diff.generated_content.trim().split(/\s+/).slice(0, 60).join(' ');
        const userExcerpt = diff.content.trim().split(/\s+/).slice(0, 60).join(' ');
        return `[${diff.day_date}]\nAI wrote: "${aiExcerpt}..."\nUser changed to: "${userExcerpt}..."`;
      })
      .join('\n\n');
  }

  private combineNotes(moment: MomentLike): string | null {
    const parts = [moment.text_context?.trim(), moment.voice_transcript?.trim()].filter(
      (value): value is string => Boolean(value),
    );
    return parts.length > 0 ? parts.join('\n') : null;
  }

  private orderMomentsByIds(moments: MomentLike[], momentIds?: string[]): MomentLike[] {
    if (!momentIds || momentIds.length === 0) return moments;

    const orderIndexById = new Map(momentIds.map((id, index) => [id, index]));

    return [...moments].sort((left, right) => {
      const leftIndex = orderIndexById.get(left.id);
      const rightIndex = orderIndexById.get(right.id);
      if (leftIndex === undefined && rightIndex === undefined) return 0;
      if (leftIndex === undefined) return 1;
      if (rightIndex === undefined) return -1;
      return leftIndex - rightIndex;
    });
  }

  private firstWords(content: string, wordCount: number): string {
    return content.trim().split(/\s+/).slice(0, wordCount).join(' ');
  }

  // ─── Rate limiting ───

  private enforceRateLimit(userId: string, date: string) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const key = `${userId}:${date}:${today}`;
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const attempts = (GenerationService.generationAttempts.get(key) ?? []).filter((ts) => ts > dayAgo);

    if (attempts.length >= 3) {
      throw new HttpException({ error: 'Generation rate limit exceeded' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    attempts.push(now);
    GenerationService.generationAttempts.set(key, attempts);
  }

  // ─── Fallback journal ───

  private buildFallbackJournal(
    date: string,
    persona: PersonaLike,
    describedMoments: Array<{
      time: string;
      mood: string | null;
      photoUrls: string[];
      notes: string | null;
    }>,
  ): string {
    const dateLabel = format(new Date(`${date}T12:00:00`), 'EEEE, MMMM d, yyyy');
    const voiceLabel = this.resolveVoiceLabel(persona.narrative_voice as NarrativeVoice);
    const intro =
      persona.writing_style === 'poetic'
        ? `On ${dateLabel}, the day unfolded in small, memorable fragments.`
        : `On ${dateLabel}, ${voiceLabel} moved through a day worth keeping.`;

    const momentParagraphs = describedMoments.map((moment) => {
      const moodText = moment.mood ? ` The mood felt ${moment.mood}.` : '';
      const noteText = moment.notes ? ` ${moment.notes}` : '';
      const photoText = moment.photoUrls.length > 0
        ? ` ${moment.photoUrls.length} photo(s) captured.`
        : '';
      return `Around ${moment.time}, a moment was captured.${moodText}${noteText}${photoText}`.trim();
    });

    const closing =
      persona.emotional_depth === 'deep'
        ? 'Even in this fallback draft, the shape of the day still feels personal enough to return to.'
        : 'It is a simple draft, but it still keeps the outline of the day intact.';

    return [intro, ...momentParagraphs, closing].join('\n\n');
  }

  private resolveVoiceLabel(voice: NarrativeVoice): string {
    switch (voice) {
      case 'second_person':
        return 'you';
      case 'third_person':
        return 'they';
      case 'first_person':
      default:
        return 'I';
    }
  }
}
