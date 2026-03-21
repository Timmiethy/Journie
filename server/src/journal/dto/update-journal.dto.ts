import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateJournalDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'confirmed'])
  status?: string;
}
