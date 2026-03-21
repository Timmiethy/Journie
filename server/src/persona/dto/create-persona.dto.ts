import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

const WRITING_STYLES = ['poetic', 'casual', 'reflective', 'witty'] as const;
const JOURNAL_TOPICS = ['emotions', 'events', 'growth', 'relationships', 'ideas', 'gratitude'] as const;
const NARRATIVE_VOICES = ['first_person', 'second_person', 'third_person'] as const;
const EMOTIONAL_DEPTHS = ['light', 'moderate', 'deep'] as const;
const PERSONALITY_TAGS = [
  'introvert',
  'extrovert',
  'night-owl',
  'early-bird',
  'coffee-lover',
  'foodie',
  'tech-nerd',
  'creative',
  'adventurous',
  'homebody',
  'overthinker',
  'optimist',
] as const;
const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;
const OCCUPATIONS = ['student', 'professional', 'freelancer', 'between', 'skip'] as const;
const DAILY_PEOPLE = ['partner', 'close-friends', 'family', 'coworkers', 'mostly-solo', 'pets'] as const;
const DAILY_ACTIVITIES = [
  'work-school',
  'cooking',
  'exercise',
  'reading',
  'music-art',
  'gaming',
  'nature',
  'cafe-culture',
  'side-projects',
  'travel',
  'socializing',
  'self-care',
] as const;

export class CreatePersonaDto {
  @IsString()
  @IsIn(WRITING_STYLES)
  writing_style!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @IsIn(JOURNAL_TOPICS, { each: true })
  journal_topics!: string[];

  @IsString()
  @IsIn(NARRATIVE_VOICES)
  narrative_voice!: string;

  @IsString()
  @IsIn(EMOTIONAL_DEPTHS)
  emotional_depth!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @IsIn(PERSONALITY_TAGS, { each: true })
  personality_tags!: string[];

  @IsOptional()
  @IsString()
  @IsIn(MBTI_TYPES)
  mbti?: string;

  @IsOptional()
  @IsString()
  @IsIn(OCCUPATIONS)
  occupation?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(DAILY_PEOPLE, { each: true })
  daily_people!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @IsIn(DAILY_ACTIVITIES, { each: true })
  daily_activities!: string[];

  @IsOptional()
  @IsString()
  additional_context?: string;
}
