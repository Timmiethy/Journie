import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

const ATTENTION_FILTERS = ['memes', 'people', 'aesthetics', 'selfies'] as const;
const LIFE_CHAPTERS = ['building', 'cruising', 'chaos', 'waiting'] as const;
const TONE_PRESETS = ['poetic', 'stoic', 'roast', 'hype'] as const;
const DAILY_PEOPLE = ['partner', 'close-friends', 'family', 'coworkers', 'mostly-solo', 'pets'] as const;

export class CreatePersonaDto {
  @IsString()
  @IsIn(ATTENTION_FILTERS)
  attention_filter!: string;

  @IsString()
  @IsIn(LIFE_CHAPTERS)
  life_chapter!: string;

  @IsString()
  @IsIn(TONE_PRESETS)
  tone_preset!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(DAILY_PEOPLE, { each: true })
  daily_people!: string[];

  @IsOptional()
  @IsString()
  additional_context?: string;
}
