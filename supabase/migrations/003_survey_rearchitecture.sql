-- ============================================================
-- Migration 003: Survey Rearchitecture
-- Replaces 11-step persona fields with 5-question high-impact schema.
-- Keeps daily_people and additional_context untouched.
-- ============================================================

-- Step 1: Add new columns
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS attention_filter text,
  ADD COLUMN IF NOT EXISTS life_chapter text,
  ADD COLUMN IF NOT EXISTS tone_preset text;

-- Step 2: Backfill existing rows (if any)
UPDATE personas SET
  attention_filter = 'aesthetics',
  life_chapter = 'building',
  tone_preset = CASE
    WHEN writing_style = 'poetic' THEN 'poetic'
    WHEN writing_style = 'witty'  THEN 'roast'
    WHEN writing_style = 'casual' THEN 'hype'
    ELSE 'stoic'
  END
WHERE attention_filter IS NULL;

-- Step 3: Add CHECK constraints
ALTER TABLE personas
  ADD CONSTRAINT chk_attention_filter
    CHECK (attention_filter IN ('memes', 'people', 'aesthetics', 'selfies')),
  ADD CONSTRAINT chk_life_chapter
    CHECK (life_chapter IN ('building', 'cruising', 'chaos', 'waiting')),
  ADD CONSTRAINT chk_tone_preset
    CHECK (tone_preset IN ('poetic', 'stoic', 'roast', 'hype'));

-- Step 4: Make new columns NOT NULL
ALTER TABLE personas
  ALTER COLUMN attention_filter SET NOT NULL,
  ALTER COLUMN life_chapter SET NOT NULL,
  ALTER COLUMN tone_preset SET NOT NULL;

-- Step 5: Drop old columns
ALTER TABLE personas
  DROP COLUMN IF EXISTS writing_style,
  DROP COLUMN IF EXISTS journal_topics,
  DROP COLUMN IF EXISTS narrative_voice,
  DROP COLUMN IF EXISTS emotional_depth,
  DROP COLUMN IF EXISTS personality_tags,
  DROP COLUMN IF EXISTS mbti,
  DROP COLUMN IF EXISTS occupation,
  DROP COLUMN IF EXISTS daily_activities;
