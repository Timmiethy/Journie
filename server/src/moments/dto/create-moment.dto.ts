import { IsIn, IsISO8601, IsOptional, IsString, Matches } from 'class-validator';

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
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day_date?: string;
}
