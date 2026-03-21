import { IsArray, IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class GenerateJournalDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  momentIds?: string[];
}
