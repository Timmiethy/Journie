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
import { VisionService } from './vision.service';
import { VoiceProfileService } from './voice-profile.service';
import { OpenaiService } from '../../ai/openai.service';
import { buildSystemPrompt, buildUserMessage } from './prompts';

type NarrativeVoice = 'first_person' | 'second_person' | 'third_person';

type MomentLike = {
  id: string;
  text_context?: string | null;
  voice_transcript?: string | null;
  mood?: string | null;
  captured_at: string;
  photos?: Array<{ photo_url: string; storage_path: string }>;
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
};

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
    private visionService: VisionService,
    private voiceProfileService: VoiceProfileService,
    private openaiService: OpenaiService,
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

  private async runGenerationPipeline(
    userId: string,
    date: string,
    regenerate: boolean,
    momentIds?: string[],
  ) {
    try {
      const [persona, moments, recentJournals, voiceProfile, editDiffs] = await Promise.all([
        this.personaService.findByUserId(userId),
        this.momentsService.findByDate(userId, date),
        this.fetchRecentJournals(userId, date),
        this.voiceProfileService.getProfile(userId),
        this.voiceProfileService.getRecentEditDiffs(userId),
      ]);

      const orderedMoments = this.orderMomentsByIds(moments as MomentLike[], momentIds);

      if (!persona) {
        throw new BadRequestException({ error: 'Persona not found' });
      }

      const describedMoments = await Promise.all(
        orderedMoments.map(async (moment, index) => ({
          index,
          time: format(new Date(moment.captured_at), 'h:mm a'),
          mood: moment.mood ?? null,
          photoDescriptions: await this.visionService.describePhotos(
            await this.getSignedPhotoUrls(moment.photos ?? []),
          ),
          notes: this.combineNotes(moment),
        })),
      );

      const systemPrompt = buildSystemPrompt(
        persona as PersonaLike,
        this.buildRecentJournalExcerptBlock(recentJournals),
        this.voiceProfileService.formatProfileForPrompt(voiceProfile),
        this.voiceProfileService.formatEditDiffsForPrompt(editDiffs),
      );
      const userMessage = buildUserMessage(
        describedMoments,
        format(new Date(`${date}T12:00:00`), 'EEEE, MMMM d, yyyy'),
      );
      const content = await this.generateJournalContent(
        date,
        persona as PersonaLike,
        describedMoments,
        systemPrompt,
        userMessage,
      );

      await this.updateGeneratedJournal(userId, date, content, regenerate);

      // Trigger voice profile refresh check (non-blocking)
      this.voiceProfileService.maybeRefreshProfile(userId);
    } catch (error) {
      await this.markGenerationFailure(userId, date, regenerate);
      this.logger.error(
        `Journal generation failed for user ${userId}, date ${date}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

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

  private buildRecentJournalExcerptBlock(journals: JournalLike[]): string {
    if (journals.length === 0) {
      return 'No previous journals yet.';
    }

    return journals
      .map((journal, index) => `[Journal ${index + 1}] ${this.firstWords(journal.content, 150)}`)
      .join('\n\n');
  }

  private async getSignedPhotoUrls(photos: Array<{ photo_url: string; storage_path: string }>): Promise<string[]> {
    if (photos.length === 0) {
      return [];
    }

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

  private combineNotes(moment: MomentLike): string | null {
    const parts = [moment.text_context?.trim(), moment.voice_transcript?.trim()].filter(
      (value): value is string => Boolean(value),
    );

    return parts.length > 0 ? parts.join('\n') : null;
  }

  private orderMomentsByIds(moments: MomentLike[], momentIds?: string[]): MomentLike[] {
    if (!momentIds || momentIds.length === 0) {
      return moments;
    }

    const orderIndexById = new Map(momentIds.map((id, index) => [id, index]));

    return [...moments].sort((left, right) => {
      const leftIndex = orderIndexById.get(left.id);
      const rightIndex = orderIndexById.get(right.id);

      if (leftIndex === undefined && rightIndex === undefined) {
        return 0;
      }

      if (leftIndex === undefined) {
        return 1;
      }

      if (rightIndex === undefined) {
        return -1;
      }

      return leftIndex - rightIndex;
    });
  }

  private firstWords(content: string, wordCount: number): string {
    return content.trim().split(/\s+/).slice(0, wordCount).join(' ');
  }

  private async updateGeneratedJournal(
    userId: string,
    date: string,
    content: string,
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
          generated_at: timestamp,
          confirmed_at: null,
          updated_at: timestamp,
          ...(regenerate ? {} : { created_at: timestamp }),
        },
        { onConflict: 'user_id,day_date' },
      );

    if (error && isMissingSchemaObject(error, 'generated_content')) {
      this.logger.warn('journal_entries.generated_content is missing; preserving original AI output is disabled until the migration is applied');
      const fallback = await supabase
        .from('journal_entries')
        .upsert(
          {
            user_id: userId,
            day_date: date,
            content,
            status: 'draft',
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
          generated_at: timestamp,
          updated_at: timestamp,
          ...(regenerate ? {} : { created_at: timestamp }),
        },
        { onConflict: 'user_id,day_date' },
      );
  }

  private async generateJournalContent(
    date: string,
    persona: PersonaLike,
    describedMoments: Array<{
      index: number;
      time: string;
      mood: string | null;
      photoDescriptions: string;
      notes: string | null;
    }>,
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    const openai = this.openaiService.getClient();
    if (!openai) {
      return this.buildFallbackJournal(date, persona, describedMoments);
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 1500,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (content) {
        return content;
      }
    } catch (error) {
      if (this.openaiService.isConfigurationError(error)) {
        this.openaiService.disableClient();
      }
      this.logger.warn(
        `Falling back to deterministic journal for ${date}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    return this.buildFallbackJournal(date, persona, describedMoments);
  }

  private buildFallbackJournal(
    date: string,
    persona: PersonaLike,
    describedMoments: Array<{
      time: string;
      mood: string | null;
      photoDescriptions: string;
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
      const photoText = moment.photoDescriptions ? ` ${moment.photoDescriptions}` : '';
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
