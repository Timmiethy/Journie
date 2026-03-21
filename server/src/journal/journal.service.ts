import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

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
    } else if (updates.status === 'draft') {
      updateData.confirmed_at = null;
    }

    // If user is editing content, preserve the original AI-generated version
    // so we can learn from the diff later
    if (updates.content !== undefined) {
      const { data: existing } = await supabase
        .from('journal_entries')
        .select('generated_content, content')
        .eq('user_id', userId)
        .eq('day_date', date)
        .single();

      // Only set generated_content if it hasn't been set yet (first edit after generation)
      if (existing && !existing.generated_content && existing.content) {
        updateData.generated_content = existing.content;
      }
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
    const entries = data ?? [];

    if (entries.length === 0) {
      return [];
    }

    const dayDates = entries.map((entry) => entry.day_date);
    const { data: moments, error: momentsError } = await supabase
      .from('moments')
      .select('id, day_date, order_index, moment_photos(photo_url, order_index)')
      .eq('user_id', userId)
      .in('day_date', dayDates)
      .order('day_date', { ascending: false })
      .order('order_index', { ascending: true });

    if (momentsError) {
      this.logger.error(
        `Failed to fetch journal thumbnails for user ${userId}: ${momentsError.message}`,
      );
      throw momentsError;
    }

    const firstPhotoByDate = new Map<string, string | null>();
    for (const moment of moments ?? []) {
      if (firstPhotoByDate.has(moment.day_date)) {
        continue;
      }

      const photos = [...(moment.moment_photos ?? [])].sort((a, b) => a.order_index - b.order_index);
      firstPhotoByDate.set(moment.day_date, photos[0]?.photo_url ?? null);
    }

    return entries.map((entry) => ({
      ...entry,
      first_photo_url: firstPhotoByDate.get(entry.day_date) ?? null,
    }));
  }
}
