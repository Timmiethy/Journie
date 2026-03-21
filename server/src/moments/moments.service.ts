import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
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
  private readonly logger = new Logger(MomentsService.name);
  private readonly allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
  private readonly maxFileSizeBytes = 10 * 1024 * 1024;

  constructor(private supabaseService: SupabaseService) {}

  async findByDate(userId: string, date: string) {
    if (!date) {
      throw new BadRequestException({ error: 'date is required' });
    }

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
    if (files.length === 0) {
      throw new BadRequestException({ error: 'At least one photo is required' });
    }

    this.validateFiles(files);

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

    try {
      const photos = await this.persistMomentPhotos(userId, dayDate, moment.id, files);
      return { ...moment, photos };
    } catch (error) {
      await supabase.from('moments').delete().eq('id', moment.id).eq('user_id', userId);
      throw error;
    }
  }

  async remove(userId: string, momentId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: photos } = await supabase
      .from('moment_photos')
      .select('storage_path')
      .eq('moment_id', momentId);

    const storagePaths = (photos ?? [])
      .map((photo) => photo.storage_path)
      .filter((storagePath) => Boolean(storagePath));

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from('moment-photos').remove(storagePaths);
      if (storageError) {
        this.logger.error(
          `Failed to delete storage photos for user ${userId}, moment ${momentId}: ${storageError.message}`,
        );
        throw new InternalServerErrorException({ error: 'Photo delete failed' });
      }
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
    const timestamp = new Date().toISOString();

    for (let index = 0; index < dto.order.length; index += 1) {
      const { error } = await supabase
        .from('moments')
        .update({ order_index: index, updated_at: timestamp })
        .eq('id', dto.order[index])
        .eq('user_id', userId)
        .eq('day_date', dto.date);

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
    const uploadedStoragePaths: string[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const storagePath = `${userId}/${dayDate}/${momentId}/${index}.jpg`;

      try {
        const { error: uploadError } = await supabase.storage
          .from('moment-photos')
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype || 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        uploadedStoragePaths.push(storagePath);

        const signed = await supabase.storage
          .from('moment-photos')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 30);

        if (signed.error || !signed.data?.signedUrl) {
          throw signed.error ?? new Error('Failed to create photo URL');
        }

        photoRows.push({
          moment_id: momentId,
          storage_path: storagePath,
          photo_url: signed.data.signedUrl,
          order_index: index,
        });
      } catch (error) {
        if (uploadedStoragePaths.length > 0) {
          await supabase.storage.from('moment-photos').remove(uploadedStoragePaths);
        }

        this.logger.error(
          `Photo upload failed for user ${userId}, moment ${momentId}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        throw new InternalServerErrorException({ error: 'Photo upload failed' });
      }
    }

    const { data, error } = await supabase
      .from('moment_photos')
      .insert(photoRows)
      .select('*');

    if (error) {
      await supabase.storage.from('moment-photos').remove(uploadedStoragePaths);
      this.logger.error(`Failed to insert moment photo rows for moment ${momentId}: ${error.message}`);
      throw error;
    }
    return (data ?? []).sort((a, b) => a.order_index - b.order_index);
  }

  private validateFiles(files: Express.Multer.File[]) {
    for (const file of files) {
      if (!this.allowedMimeTypes.has(file.mimetype)) {
        throw new BadRequestException({ error: 'Unsupported photo type' });
      }

      if (file.size > this.maxFileSizeBytes) {
        throw new BadRequestException({ error: 'Photo exceeds 10MB limit' });
      }
    }
  }
}
