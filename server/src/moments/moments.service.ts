import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { CreateMomentDto } from './dto/create-moment.dto';
import { ReorderMomentsDto } from './dto/reorder-moments.dto';
import { format } from 'date-fns';

@Injectable()
export class MomentsService {
  constructor(private supabaseService: SupabaseService) {}

  async findByDate(userId: string, date: string) {
    const supabase = this.supabaseService.getClient();
    const { data: moments, error } = await supabase
      .from('moments')
      .select('*, moment_photos(*)')
      .eq('user_id', userId)
      .eq('day_date', date)
      .order('order_index');

    if (error) throw error;
    return (moments ?? []).map((m) => ({
      ...m,
      photos: m.moment_photos ?? [],
    }));
  }

  async create(userId: string, dto: CreateMomentDto, _files: Express.Multer.File[]) {
    const supabase = this.supabaseService.getClient();
    const dayDate = dto.day_date || format(new Date(), 'yyyy-MM-dd');

    // Get next order_index
    const { count } = await supabase
      .from('moments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('day_date', dayDate);

    const { data: moment, error } = await supabase
      .from('moments')
      .insert({
        user_id: userId,
        day_date: dayDate,
        order_index: count ?? 0,
        text_context: dto.text_context,
        voice_transcript: dto.voice_transcript,
        mood: dto.mood,
        captured_at: dto.captured_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // TODO: Upload files to Supabase Storage and insert moment_photos rows

    return { ...moment, photos: [] };
  }

  async remove(userId: string, momentId: string) {
    const supabase = this.supabaseService.getClient();

    // TODO: Delete files from storage bucket

    const { error } = await supabase
      .from('moments')
      .delete()
      .eq('id', momentId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async reorder(userId: string, dto: ReorderMomentsDto) {
    const supabase = this.supabaseService.getClient();

    for (let i = 0; i < dto.order.length; i++) {
      const { error } = await supabase
        .from('moments')
        .update({ order_index: i })
        .eq('id', dto.order[i])
        .eq('user_id', userId);

      if (error) throw error;
    }
  }
}
