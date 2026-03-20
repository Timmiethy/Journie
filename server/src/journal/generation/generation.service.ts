import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { OpenaiService } from '../../ai/openai.service';
import { PersonaService } from '../../persona/persona.service';
import { MomentsService } from '../../moments/moments.service';
import { VisionService } from './vision.service';
import { buildSystemPrompt, buildUserMessage } from './prompts';
import { format } from 'date-fns';

@Injectable()
export class GenerationService {
  constructor(
    private supabaseService: SupabaseService,
    private openaiService: OpenaiService,
    private personaService: PersonaService,
    private momentsService: MomentsService,
    private visionService: VisionService,
  ) {}

  async generate(userId: string, date: string, regenerate = false) {
    const supabase = this.supabaseService.getClient();

    // Create or update journal entry with generating status
    if (regenerate) {
      await supabase
        .from('journal_entries')
        .update({ status: 'generating', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('day_date', date);
    } else {
      await supabase.from('journal_entries').insert({
        user_id: userId,
        day_date: date,
        status: 'generating',
      });
    }

    // TODO: Full AI pipeline implementation
    // Step 1: Gather context (persona, moments, recent journals)
    // Step 2: Process photos with vision
    // Step 3: Assemble generation prompt
    // Step 4: Generate with GPT-4o
    // Step 5: Store result

    const { data: entry } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('day_date', date)
      .single();

    return { journal_id: entry?.id, status: 'generating' };
  }
}
