import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { CreatePersonaDto } from './dto/create-persona.dto';

@Injectable()
export class PersonaService {
  private readonly logger = new Logger(PersonaService.name);

  constructor(private supabaseService: SupabaseService) {}

  async upsert(userId: string, dto: CreatePersonaDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('personas')
      .upsert(
        { user_id: userId, ...dto, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to upsert persona for user ${userId}: ${error.message}`);
      throw error;
    }
    return data;
  }

  async findByUserId(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
}
