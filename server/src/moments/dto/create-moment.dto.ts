import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateMomentDto {
  @IsOptional()
  @IsString()
  text_context?: string;

  @IsOptional()
  @IsString()
  voice_transcript?: string;

  @IsOptional()
  @IsIn(['great', 'good', 'neutral', 'low', 'rough'])
  mood?: string;

  @IsOptional()
  @IsString()
  captured_at?: string;

  @IsOptional()
  @IsString()
  day_date?: string;
}
