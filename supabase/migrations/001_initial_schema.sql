-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── Personas ───
create table personas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  writing_style text not null check (writing_style in ('poetic', 'casual', 'reflective', 'witty')),
  journal_topics text[] not null default '{}',
  narrative_voice text not null check (narrative_voice in ('first_person', 'second_person', 'third_person')),
  emotional_depth text not null check (emotional_depth in ('light', 'moderate', 'deep')),
  personality_tags text[] not null default '{}',
  mbti text check (mbti in (
    'INTJ','INTP','ENTJ','ENTP',
    'INFJ','INFP','ENFJ','ENFP',
    'ISTJ','ISFJ','ESTJ','ESFJ',
    'ISTP','ISFP','ESTP','ESFP'
  )),
  occupation text check (occupation in ('student', 'professional', 'freelancer', 'between', 'skip')),
  daily_people text[] not null default '{}',
  daily_activities text[] not null default '{}',
  additional_context text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Moments ───
create table moments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  day_date date not null,
  order_index int not null default 0,
  text_context text,
  voice_transcript text,
  mood text check (mood in ('great', 'good', 'neutral', 'low', 'rough')),
  captured_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_moments_user_day on moments(user_id, day_date);

-- ─── Moment Photos ───
create table moment_photos (
  id uuid primary key default uuid_generate_v4(),
  moment_id uuid references moments(id) on delete cascade not null,
  storage_path text not null,
  photo_url text not null,
  order_index int not null default 0,
  created_at timestamptz default now()
);

create index idx_moment_photos_moment on moment_photos(moment_id);

-- ─── Journal Entries ───
create table journal_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  day_date date not null,
  content text not null default '',
  status text not null default 'generating' check (status in ('generating', 'draft', 'confirmed')),
  generated_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index idx_journal_user_day on journal_entries(user_id, day_date);

-- ─── Row Level Security ───
alter table personas enable row level security;
alter table moments enable row level security;
alter table moment_photos enable row level security;
alter table journal_entries enable row level security;

create policy "Users own their persona" on personas
  for all using (auth.uid() = user_id);

create policy "Users own their moments" on moments
  for all using (auth.uid() = user_id);

create policy "Users own their photos" on moment_photos
  for all using (
    moment_id in (select id from moments where user_id = auth.uid())
  );

create policy "Users own their journals" on journal_entries
  for all using (auth.uid() = user_id);

-- ─── Storage bucket policy (run after creating 'moment-photos' bucket) ───

-- Allow users to upload to their own folder
-- create policy "Users upload own photos"
-- on storage.objects for insert
-- with check (
--   bucket_id = 'moment-photos'
--   and (storage.foldername(name))[1] = auth.uid()::text
-- );

-- Allow users to read their own photos
-- create policy "Users read own photos"
-- on storage.objects for select
-- using (
--   bucket_id = 'moment-photos'
--   and (storage.foldername(name))[1] = auth.uid()::text
-- );
