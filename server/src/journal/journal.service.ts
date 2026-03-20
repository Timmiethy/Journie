import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class JournalService {
  constructor(private supabaseService: SupabaseService) {}

  async findByDate(userId: string, date: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('day_date', date)
      .single();

    if (error && error.code === 'PGRST116') {
      throw new NotFoundException('No journal entry for this date');
    }
    if (error) throw error;
    return data;
  }

  async update(userId: string, date: string, updates: { content?: string; status?: string }) {
    const supabase = this.supabaseService.getClient();

    const updateData: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (updates.status === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .update(updateData)
      .eq('user_id', userId)
      .eq('day_date', date)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listByUser(userId: string, limit = 30, offset = 0, status?: string) {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('day_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }
}
