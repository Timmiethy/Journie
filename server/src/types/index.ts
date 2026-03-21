// ─── User & Persona ───

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Persona {
  id: string;
  user_id: string;
  writing_style: WritingStyle;
  journal_topics: JournalTopic[];
  narrative_voice: NarrativeVoice;
  emotional_depth: EmotionalDepth;
  personality_tags: PersonalityTag[];
  mbti: MBTIType | null;
  occupation: Occupation | null;
  daily_people: DailyPerson[];
  daily_activities: DailyActivity[];
  additional_context: string | null;
  created_at: string;
  updated_at: string;
}

export type WritingStyle = 'poetic' | 'casual' | 'reflective' | 'witty';
export type JournalTopic = 'emotions' | 'events' | 'growth' | 'relationships' | 'ideas' | 'gratitude';
export type NarrativeVoice = 'first_person' | 'second_person' | 'third_person';
export type EmotionalDepth = 'light' | 'moderate' | 'deep';
export type PersonalityTag =
  | 'introvert' | 'extrovert' | 'night-owl' | 'early-bird'
  | 'coffee-lover' | 'foodie' | 'tech-nerd' | 'creative'
  | 'adventurous' | 'homebody' | 'overthinker' | 'optimist';
export type MBTIType =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';
export type Occupation = 'student' | 'professional' | 'freelancer' | 'between' | 'skip';
export type DailyPerson = 'partner' | 'close-friends' | 'family' | 'coworkers' | 'mostly-solo' | 'pets';
export type DailyActivity =
  | 'work-school' | 'cooking' | 'exercise' | 'reading'
  | 'music-art' | 'gaming' | 'nature' | 'cafe-culture'
  | 'side-projects' | 'travel' | 'socializing' | 'self-care';

// ─── Moments ───

export interface Moment {
  id: string;
  user_id: string;
  day_date: string;
  order_index: number;
  text_context: string | null;
  voice_transcript: string | null;
  mood: Mood | null;
  captured_at: string;
  created_at: string;
  updated_at: string;
}

export type Mood = 'great' | 'good' | 'neutral' | 'low' | 'rough';

export interface MomentPhoto {
  id: string;
  moment_id: string;
  storage_path: string;
  photo_url: string;
  order_index: number;
  created_at: string;
}

// ─── Journal ───

export interface JournalEntry {
  id: string;
  user_id: string;
  day_date: string;
  content: string;
  generated_content: string | null;
  status: JournalStatus;
  generated_at: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type JournalStatus = 'generating' | 'draft' | 'confirmed';

// ─── Voice Profile ───

export interface VoiceProfile {
  id: string;
  user_id: string;
  voice_summary: string;
  preferred_phrases: string[];
  avoided_phrases: string[];
  journals_analyzed: number;
  last_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Aggregated Types ───

export interface MomentWithPhotos extends Moment {
  photos: MomentPhoto[];
}

export interface DayTimeline {
  date: string;
  moments: MomentWithPhotos[];
  journal: JournalEntry | null;
}
