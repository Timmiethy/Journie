import { IsDateString, IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

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
  @IsISO8601()
  captured_at?: string;

  @IsOptional()
  @IsDateString()
  day_date?: string;
}
