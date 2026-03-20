import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { CreatePersonaDto } from './dto/create-persona.dto';

@Injectable()
export class PersonaService {
  constructor(private supabaseService: SupabaseService) {}

  async upsert(userId: string, dto: CreatePersonaDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('personas')
      .upsert({ user_id: userId, ...dto }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
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
