import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { PersonaService } from '../../persona/persona.service';
import { MomentsService } from '../../moments/moments.service';

type NarrativeVoice = 'first_person' | 'second_person' | 'third_person';
type WritingStyle = 'poetic' | 'casual' | 'reflective' | 'witty';

type PersonaLike = {
  writing_style?: WritingStyle;
  narrative_voice?: NarrativeVoice;
  additional_context?: string | null;
};

type MomentLike = {
  text_context?: string | null;
  voice_transcript?: string | null;
  mood?: string | null;
  captured_at: string;
  photos?: Array<{ photo_url: string }>;
};

@Injectable()
export class GenerationService {
  constructor(
    private supabaseService: SupabaseService,
    private personaService: PersonaService,
    private momentsService: MomentsService,
  ) {}

  async generate(userId: string, date: string, regenerate = false) {
    const supabase = this.supabaseService.getClient();

    await supabase
      .from('journal_entries')
      .upsert(
        {
          user_id: userId,
          day_date: date,
          status: 'generating',
          updated_at: new Date().toISOString(),
          ...(regenerate ? {} : { created_at: new Date().toISOString() }),
        },
        { onConflict: 'user_id,day_date' },
      );

    const [persona, moments] = await Promise.all([
      this.personaService.findByUserId(userId),
      this.momentsService.findByDate(userId, date),
    ]);

    const content = this.buildJournalContent(
      date,
      persona as PersonaLike | null,
      moments as MomentLike[],
    );

    const timestamp = new Date().toISOString();
    const { data, error } = await supabase
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
      )
      .select()
      .single();

    if (error) throw error;
    return { journal_id: data.id, status: data.status };
  }

  private buildJournalContent(
    date: string,
    persona: PersonaLike | null,
    moments: MomentLike[],
  ): string {
    const style = persona?.writing_style ?? 'reflective';
    const voice = persona?.narrative_voice ?? 'first_person';
    const opener = this.buildOpeningParagraph(date, style, voice, persona?.additional_context ?? null);

    if (moments.length === 0) {
      return [
        opener,
        this.buildEmptyDayParagraph(style, voice),
        this.buildClosingParagraph(style, voice, 0),
      ].join('\n\n');
    }

    const momentParagraphs = moments.map((moment, index) =>
      this.buildMomentParagraph(moment, index, style, voice),
    );

    return [opener, ...momentParagraphs, this.buildClosingParagraph(style, voice, moments.length)].join('\n\n');
  }

  private buildOpeningParagraph(
    date: string,
    style: WritingStyle,
    voice: NarrativeVoice,
    additionalContext: string | null,
  ): string {
    const tokens = this.voiceTokens(voice);
    const formattedDate = format(new Date(`${date}T12:00:00`), 'EEEE, MMMM d');
    const contextNote = additionalContext?.trim()
      ? ` ${tokens.subject} carried ${tokens.possessive} current chapter into it: ${this.quote(additionalContext)}.`
      : '';

    switch (style) {
      case 'poetic':
        return `${formattedDate} arrived with a quiet shape to it, and ${tokens.subject.toLowerCase()} moved through it one moment at a time.${contextNote}`;
      case 'casual':
        return `${formattedDate} was the kind of day that made sense once ${tokens.subject.toLowerCase()} looked back at it.${contextNote}`;
      case 'witty':
        return `${formattedDate} did what good days do: it slipped by quickly and still left enough behind to write about.${contextNote}`;
      case 'reflective':
      default:
        return `${formattedDate} gathered itself through the smaller details, and ${tokens.subject.toLowerCase()} could trace the day by following those moments back.${contextNote}`;
    }
  }

  private buildEmptyDayParagraph(style: WritingStyle, voice: NarrativeVoice): string {
    const tokens = this.voiceTokens(voice);

    switch (style) {
      case 'poetic':
        return `${tokens.subject} did not leave many artifacts behind today, only the outline of a day and the sense that it still mattered.`;
      case 'casual':
        return `${tokens.subject} kept things light today, with more living than documenting.`;
      case 'witty':
        return `${tokens.subject} somehow managed to have a whole day without leaving much evidence, which is honestly impressive.`;
      case 'reflective':
      default:
        return `There were not many captured moments today, but even that says something about the pace ${tokens.subject.toLowerCase()} kept.`;
    }
  }

  private buildMomentParagraph(
    moment: MomentLike,
    index: number,
    style: WritingStyle,
    voice: NarrativeVoice,
  ): string {
    const tokens = this.voiceTokens(voice);
    const timeLabel = format(new Date(moment.captured_at), 'h:mm a');
    const moodLine = this.describeMood(moment.mood, voice);
    const note = this.cleanText(moment.text_context || moment.voice_transcript);
    const noteSentence = note
      ? `${tokens.subject} held onto ${tokens.possessive} own words in that moment: ${this.quote(note)}.`
      : this.buildNoNoteSentence(moment, tokens.subject);
    const photoSentence = this.buildPhotoSentence(moment, tokens.subject, index);

    switch (style) {
      case 'poetic':
        return `At ${timeLabel}, the day shifted again. ${moodLine} ${noteSentence} ${photoSentence}`.trim();
      case 'casual':
        return `Around ${timeLabel}, ${tokens.subject.toLowerCase()} was in the middle of it. ${moodLine} ${noteSentence} ${photoSentence}`.trim();
      case 'witty':
        return `By ${timeLabel}, the day had already committed to the bit. ${moodLine} ${noteSentence} ${photoSentence}`.trim();
      case 'reflective':
      default:
        return `By ${timeLabel}, another piece of the day had come into focus. ${moodLine} ${noteSentence} ${photoSentence}`.trim();
    }
  }

  private buildClosingParagraph(style: WritingStyle, voice: NarrativeVoice, momentCount: number): string {
    const tokens = this.voiceTokens(voice);

    switch (style) {
      case 'poetic':
        return `*By the end of it, ${tokens.subject.toLowerCase()} had more than a record of the day; ${tokens.subject.toLowerCase()} had its texture still resting in ${tokens.possessive} hands.*`;
      case 'casual':
        return `*Nothing huge had to happen for the day to feel real. ${momentCount > 0 ? 'The little moments did the job.' : `${tokens.subject} still made it count.`}*`;
      case 'witty':
        return `*All told, the day held together surprisingly well. Credit the moments, the timing, and probably a little stubbornness.*`;
      case 'reflective':
      default:
        return `*Looking back, the day feels clearest in the moments ${tokens.subject.toLowerCase()} chose to keep. That is where its meaning settled.*`;
    }
  }

  private buildNoNoteSentence(moment: MomentLike, subject: string): string {
    const photoCount = moment.photos?.length ?? 0;

    if (photoCount > 0) {
      return `${subject} let the photos carry the memory here, with ${photoCount} frame${photoCount === 1 ? '' : 's'} doing most of the talking.`;
    }

    return `${subject} did not add words to this one, but the moment still made it into the shape of the day.`;
  }

  private buildPhotoSentence(moment: MomentLike, subject: string, index: number): string {
    const photoCount = moment.photos?.length ?? 0;

    if (photoCount === 0) {
      return index === 0
        ? `There was no photo attached, just the memory itself.`
        : `No photo was attached, but it still belonged in the timeline.`;
    }

    if (photoCount === 1) {
      return `${subject} kept a single photo from it, enough to pin the scene in place.`;
    }

    return `${subject} kept ${photoCount} photos from it, as if one frame was not enough to hold the whole thing.`;
  }

  private describeMood(mood: string | null | undefined, voice: NarrativeVoice): string {
    const tokens = this.voiceTokens(voice);

    switch (mood) {
      case 'great':
        return `${tokens.subject} ${tokens.was} moving through it with real lift.`;
      case 'good':
        return `The mood ${tokens.was} steady in the best way.`;
      case 'neutral':
        return `It felt even, grounded, and easy to sit inside.`;
      case 'low':
        return `There was a quieter weight to it, the kind that changes the way a moment lands.`;
      case 'rough':
        return `The edges of it were rougher, and ${tokens.subject.toLowerCase()} could feel that clearly.`;
      default:
        return `The feeling of it stayed open enough to interpret later.`;
    }
  }

  private voiceTokens(voice: NarrativeVoice) {
    switch (voice) {
      case 'second_person':
        return { subject: 'You', possessive: 'your', was: 'were' };
      case 'third_person':
        return { subject: 'They', possessive: 'their', was: 'were' };
      case 'first_person':
      default:
        return { subject: 'I', possessive: 'my', was: 'was' };
    }
  }

  private cleanText(text: string | null | undefined): string | null {
    if (!text) return null;
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned;
  }

  private quote(text: string): string {
    return `"${text.replace(/^"+|"+$/g, '')}"`;
  }
}
