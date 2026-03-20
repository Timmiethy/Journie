import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { CreateMomentDto } from './dto/create-moment.dto';
import { ReorderMomentsDto } from './dto/reorder-moments.dto';
import { format } from 'date-fns';

type MomentPhotoRow = {
  id: string;
  moment_id: string;
  storage_path: string;
  photo_url: string;
  order_index: number;
  created_at: string;
};

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

    return (moments ?? []).map((moment) => ({
      ...moment,
      photos: [...(moment.moment_photos ?? [])].sort((a, b) => a.order_index - b.order_index),
    }));
  }

  async create(userId: string, dto: CreateMomentDto, files: Express.Multer.File[] = []) {
    const supabase = this.supabaseService.getClient();
    const dayDate = dto.day_date || format(new Date(), 'yyyy-MM-dd');

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

    const photos = await this.persistMomentPhotos(userId, dayDate, moment.id, files);
    return { ...moment, photos };
  }

  async remove(userId: string, momentId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: photos } = await supabase
      .from('moment_photos')
      .select('storage_path')
      .eq('moment_id', momentId);

    const storagePaths = (photos ?? [])
      .map((photo) => photo.storage_path)
      .filter((storagePath) => storagePath && !storagePath.startsWith('inline/'));

    if (storagePaths.length > 0) {
      await supabase.storage.from('moment-photos').remove(storagePaths);
    }

    const { error } = await supabase
      .from('moments')
      .delete()
      .eq('id', momentId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async reorder(userId: string, dto: ReorderMomentsDto) {
    const supabase = this.supabaseService.getClient();

    for (let index = 0; index < dto.order.length; index += 1) {
      const { error } = await supabase
        .from('moments')
        .update({ order_index: index })
        .eq('id', dto.order[index])
        .eq('user_id', userId);

      if (error) throw error;
    }
  }

  private async persistMomentPhotos(
    userId: string,
    dayDate: string,
    momentId: string,
    files: Express.Multer.File[],
  ): Promise<MomentPhotoRow[]> {
    if (files.length === 0) {
      return [];
    }

    const supabase = this.supabaseService.getClient();
    const photoRows: Array<Omit<MomentPhotoRow, 'id' | 'created_at'>> = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const filename = `${String(index + 1).padStart(3, '0')}-${(file.originalname || 'photo').replace(/\s+/g, '-')}`;
      const storagePath = `${userId}/${dayDate}/${momentId}/${filename}`;

      let persistedPath = `inline/${storagePath}`;
      let photoUrl = this.buildInlinePhotoUrl(file);

      try {
        const { error: uploadError } = await supabase.storage
          .from('moment-photos')
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype || 'image/jpeg',
            upsert: false,
          });

        if (!uploadError) {
          const signed = await supabase.storage
            .from('moment-photos')
            .createSignedUrl(storagePath, 60 * 60 * 24 * 30);

          if (!signed.error && signed.data?.signedUrl) {
            persistedPath = storagePath;
            photoUrl = signed.data.signedUrl;
          }
        }
      } catch {
        // Fall back to inline image URLs so the frontend remains testable without storage setup.
      }

      photoRows.push({
        moment_id: momentId,
        storage_path: persistedPath,
        photo_url: photoUrl,
        order_index: index,
      });
    }

    const { data, error } = await supabase
      .from('moment_photos')
      .insert(photoRows)
      .select('*');

    if (error) throw error;
    return (data ?? []).sort((a, b) => a.order_index - b.order_index);
  }

  private buildInlinePhotoUrl(file: Express.Multer.File): string {
    const mimeType = file.mimetype || 'image/jpeg';
    return `data:${mimeType};base64,${file.buffer.toString('base64')}`;
  }
}
