import { IsString, IsArray, IsOptional, IsIn } from 'class-validator';

export class CreatePersonaDto {
  @IsString()
  @IsIn(['poetic', 'casual', 'reflective', 'witty'])
  writing_style!: string;

  @IsArray()
  @IsString({ each: true })
  journal_topics!: string[];

  @IsString()
  @IsIn(['first_person', 'second_person', 'third_person'])
  narrative_voice!: string;

  @IsString()
  @IsIn(['light', 'moderate', 'deep'])
  emotional_depth!: string;

  @IsArray()
  @IsString({ each: true })
  personality_tags!: string[];

  @IsOptional()
  @IsString()
  mbti?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsArray()
  @IsString({ each: true })
  daily_people!: string[];

  @IsArray()
  @IsString({ each: true })
  daily_activities!: string[];

  @IsOptional()
  @IsString()
  additional_context?: string;
}
