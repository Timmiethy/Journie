-- ============================================================
-- Migration 002: Tags & Writer & Memory Architecture
-- ============================================================

-- ─── Moment Tags ───
-- Per-moment tags extracted by the Tags pipeline (Qwen 2.5 Flash)
create table moment_tags (
  id uuid primary key default uuid_generate_v4(),
  moment_id uuid references moments(id) on delete cascade not null,
  tag text not null,
  category text not null check (category in (
    'activity', 'location', 'food', 'social', 'mood',
    'object', 'event', 'hobby', 'work', 'health'
  )),
  confidence real not null default 0.5 check (confidence >= 0.0 and confidence <= 1.0),
  created_at timestamptz default now()
);

-- Prevent duplicate tags per moment; also serves as the primary lookup index
create unique index idx_moment_tags_moment_tag on moment_tags(moment_id, tag);
-- Fast lookup for daily aggregation
create index idx_moment_tags_moment on moment_tags(moment_id);

-- ─── Daily Tag Summaries ───
-- One row per user per day. JSONB aggregation prevents row explosion.
create table daily_tag_summaries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  day_date date not null,
  -- top_tags: [{ "tag": "coffee", "category": "food", "score": 0.92 }, ...]
  top_tags jsonb not null default '[]'::jsonb,
  -- tag_counts: { "coffee": 3, "coding": 2, ... } — full frequency map
  tag_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index idx_daily_tags_user_day on daily_tag_summaries(user_id, day_date);

-- ─── Daily Insights ───
-- Insights extracted by the Writer pipeline, hidden from user
create table daily_insights (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  day_date date not null,
  -- insights: [{ "text": "User tried a new cafe", "confirmed": true }, ...]
  insights jsonb not null default '[]'::jsonb,
  daily_achievement text,
  best_photo_url text,
  best_photo_storage_path text,
  created_at timestamptz default now()
);

create unique index idx_daily_insights_user_day on daily_insights(user_id, day_date);

-- ─── User Memories ───
-- Long-term user knowledge store. Replaces voice_profiles.
create table user_memories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null check (category in (
    'preference', 'relationship', 'routine', 'identity', 'voice'
  )),
  fact text not null,
  confidence real not null default 0.5 check (confidence >= 0.0 and confidence <= 1.0),
  source_date date not null,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Prevent exact duplicate facts per user
create unique index idx_user_memories_user_fact on user_memories(user_id, md5(fact));
-- Fast category lookup
create index idx_user_memories_user_cat on user_memories(user_id, category);
-- Expiry cleanup index
create index idx_user_memories_expires on user_memories(expires_at) where expires_at is not null;

-- ─── Weekly Summaries ───
create table weekly_summaries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start date not null,
  week_end date not null,
  top_tags jsonb not null default '[]'::jsonb,
  summary text not null default '',
  best_photo_url text,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create unique index idx_weekly_summaries_user_week on weekly_summaries(user_id, week_start);

-- ─── Modify journal_entries ───
-- Add entry_type to distinguish daily vs weekly journals
alter table journal_entries
  add column if not exists entry_type text not null default 'daily'
    check (entry_type in ('daily', 'weekly'));

-- Add daily achievement and best photo
alter table journal_entries
  add column if not exists daily_achievement text;

alter table journal_entries
  add column if not exists best_photo_url text;

-- ─── Row Level Security for new tables ───
alter table moment_tags enable row level security;
alter table daily_tag_summaries enable row level security;
alter table daily_insights enable row level security;
alter table user_memories enable row level security;
alter table weekly_summaries enable row level security;

create policy "Users own their moment tags" on moment_tags
  for all using (
    moment_id in (select id from moments where user_id = auth.uid())
  );

create policy "Users own their daily tag summaries" on daily_tag_summaries
  for all using (auth.uid() = user_id);

create policy "Users own their daily insights" on daily_insights
  for all using (auth.uid() = user_id);

create policy "Users own their memories" on user_memories
  for all using (auth.uid() = user_id);

create policy "Users own their weekly summaries" on weekly_summaries
  for all using (auth.uid() = user_id);
