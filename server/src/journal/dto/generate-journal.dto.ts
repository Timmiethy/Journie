import { IsArray, IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class GenerateJournalDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  momentIds?: string[];
}
