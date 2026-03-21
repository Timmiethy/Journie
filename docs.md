# Journie — Architecture Document

> **Purpose of this document:** This is the single source of truth for the entire application. Any AI agent or human developer building any part of this app should read this document first and treat it as the canonical reference. If code conflicts with this doc, the doc wins.

---

## 1. Project Overview

**Journie** is a mobile-first web app that generates a personal daily journal from photos and optional voice/text context captured throughout the day. The user never writes a journal entry — they just live their day, capture moments, and the AI writes their journal for them in their personal voice.

### Core Loop

1. User completes a one-time **persona survey** (60 seconds) so the AI knows their writing style and personality.
2. Throughout the day, the user captures or imports photos on `/home`, reviews them in a full-screen overlay, and saves **moments** with optional mood, typed context, and/or voice transcription.
3. When the user is done for the day, they open **`/timeline`**, reorder or trim the day's moments, and tap **"done — generate my journal"**.
4. The app navigates immediately to **`/journal/:date`** while the backend generates the draft asynchronously from the persona, ordered moments, recent confirmed journals, learned voice profile, and recent edit corrections when available.
5. The user reviews the draft, optionally edits it, confirms it, and that confirmed output becomes part of the future voice-learning loop.

### Key Design Principles

- **Photo-first, write-nothing:** The camera is the primary input. Text and voice are always optional.
- **Low friction:** Every interaction should feel like 2–3 taps max.
- **Personal voice:** The generated journal should read as if the user wrote it on their best day — specific, emotional, never generic.
- **Mobile-first:** All layouts are designed for phones. Desktop is a nice-to-have, not a target.
- **Optimistic but resilient:** Navigation should feel instant, while async backend work continues in the background and degrades gracefully if AI services are unavailable.

---

## 2. Conventions & Agent Instructions

### Architecture

This is a **pnpm monorepo** with shared types and two runtime applications:
- `client/` — React + Vite + Tailwind CSS (frontend SPA)
- `server/` — NestJS (backend REST API)
- `shared/types.ts` — canonical shared app types, re-exported by `client/src/types/index.ts`

They communicate over HTTP. The client calls the server's REST API. They are developed and built independently but live in one repo with shared type definitions.

### Naming

- **Files and folders (client):** `kebab-case` (e.g., `moment-card.tsx`, `use-moments.ts`)
- **Files and folders (server):** `kebab-case`, following NestJS conventions (e.g., `moments.controller.ts`, `moments.service.ts`, `moments.module.ts`, `create-moment.dto.ts`)
- **React components:** `PascalCase` (e.g., `MomentCard`, `PersonaSurvey`)
- **NestJS classes:** `PascalCase` (e.g., `MomentsController`, `JournalService`, `AuthGuard`)
- **TypeScript types/interfaces:** `PascalCase` (e.g., `Moment`, `JournalEntry`)
- **Database tables:** `snake_case` (e.g., `moments`, `journal_entries`)
- **Database columns:** `snake_case` (e.g., `user_id`, `created_at`)
- **API endpoints:** `/api/kebab-case` (e.g., `/api/moments`, `/api/journal/generate`)
- **Environment variables:** `UPPER_SNAKE_CASE` (e.g., `OPENAI_API_KEY`)

### Code Style — Client (React)

- Use TypeScript everywhere. No `any` types.
- Use React Router for routing (via `react-router-dom` v6+).
- All API calls go through a shared API client (`lib/api.ts`), never raw `fetch` in components.
- Supabase client-side SDK for auth only (login, signup, session management). All data fetching goes through the NestJS backend.
- Tailwind CSS for all styling. No CSS modules. No styled-components.
- Framer Motion is the motion layer. The app is wrapped in `LazyMotion` and `MotionConfig reducedMotion="user"` in `client/src/main.tsx`.
- Route surfaces are lazy-loaded at the router level, with preload helpers in `client/src/lib/route-preloaders.ts`.
- Shared shell/layout state lives in `AuraShell`, which applies the mood-reactive aura background and constrains the main app surface to `max-width: 480px`.
- Mobile-first responsive: design around a narrow phone viewport and scale up without changing the app's single-column structure.
- All async operations should show loading states and handle errors gracefully.
- Use Zustand for global client state: auth identity, online/offline status, today's moments, current aura color, and the calendar popover state.

### Code Style — Server (NestJS)

- Use TypeScript strict mode. No `any` types.
- Follow NestJS module architecture: each feature has its own module, controller, service, and DTOs.
- Controllers handle HTTP concerns only (parse request, return response). Business logic lives in services.
- Use `class-validator` and `class-transformer` for DTO validation.
- Use NestJS Guards for authentication (validate Supabase JWT on every request).
- All Supabase DB queries go through services, using the Supabase JS client with the service role key.
- All OpenAI calls go through dedicated service classes.
- Use `@CurrentUser()` instead of reading `req.user` directly in controllers.
- Keep the API prefix at `/api`, and keep `GET /api/health` available for smoke checks and local orchestration.

### Component Architecture (Client)

- `components/ui/` — reusable primitives such as `action-button.tsx` and `horizontal-scroll-strip.tsx`
- `components/` — feature-specific building blocks such as `camera-capture.tsx`, `moment-form.tsx`, `calendar-view.tsx`, and `journal-renderer.tsx`
- `pages/` — route-level page components (one per screen)
- `lib/` — API client, motion helpers, route preloaders, navigation helpers, store, Supabase client, and utility helpers
- Keep components small. If a component exceeds ~150 lines, split it.

---

## 3. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 18 + Vite | Fast dev server, SPA with client-side routing |
| Routing (client) | React Router v6 + route-level lazy loading | Declarative SPA routing with lighter initial bundles |
| Motion | Framer Motion 12 | Shared motion primitives, layout transitions, reduced-motion support |
| Styling | Tailwind CSS + `@fontsource/inter` + `@fontsource/lora` | Utility-first styling with bundled fonts and no runtime font fetch |
| Markdown rendering | `react-markdown` | Renders generated journal content semantically |
| Client State | Zustand | Lightweight global state for moments, auth, aura, and calendar popovers |
| **Backend** | NestJS | Modular, decorator-based, TypeScript-native, scalable |
| Auth | Supabase Auth (client SDK) + NestJS Guard (JWT validation) | Client handles login/signup, server validates tokens |
| Database | Supabase (PostgreSQL) | Relational, row-level security, real-time |
| File Storage | Supabase Storage | Private bucket, server-side uploads, signed URL access |
| AI — Vision + Text | OpenAI GPT-4o | Vision descriptions, journal generation, and voice-profile distillation |
| AI — Voice Transcription | OpenAI Whisper (`whisper-1`) | Speech-to-text for optional voice context |
| Testing | Playwright + Vitest | E2E browser validation plus unit-test scaffolding |
| Deployment | Not locked in the repo yet | The verified architecture in this repo is local pnpm workspace + Supabase + OpenAI env configuration |
| Package Manager | pnpm | Fast, disk-efficient, good monorepo support |

### Key Dependencies — Client (`client/package.json`)

```json
{
  "react": "^18",
  "react-dom": "^18",
  "react-router-dom": "^6",
  "framer-motion": "^12",
  "react-markdown": "^10",
  "@supabase/supabase-js": "^2",
  "@fontsource/inter": "^5",
  "@fontsource/lora": "^5",
  "zustand": "^4",
  "tailwindcss": "^3",
  "lucide-react": "^0.462",
  "date-fns": "^3",
  "sonner": "^1"
}
```

### Key Dependencies — Server (`server/package.json`)

```json
{
  "@nestjs/core": "^10",
  "@nestjs/common": "^10",
  "@nestjs/platform-express": "^10",
  "@supabase/supabase-js": "^2",
  "openai": "^4",
  "class-validator": "^0.14",
  "class-transformer": "^0.5",
  "multer": "^1",
  "@nestjs/config": "^3",
  "date-fns": "^3"
}
```

---

## 4. Data Models

### TypeScript Interfaces

These are the canonical application types. The source of truth is `shared/types.ts`; the client re-exports them from `client/src/types/index.ts`, and the server mirrors them in `server/src/types/index.ts`.

```typescript
// shared/types.ts

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
export type PersonalityTag = 'introvert' | 'extrovert' | 'night-owl' | 'early-bird' | 'coffee-lover' | 'foodie' | 'tech-nerd' | 'creative' | 'adventurous' | 'homebody' | 'overthinker' | 'optimist';
export type MBTIType =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';
export type Occupation = 'student' | 'professional' | 'freelancer' | 'between' | 'skip';
export type DailyPerson = 'partner' | 'close-friends' | 'family' | 'coworkers' | 'mostly-solo' | 'pets';
export type DailyActivity = 'work-school' | 'cooking' | 'exercise' | 'reading' | 'music-art' | 'gaming' | 'nature' | 'cafe-culture' | 'side-projects' | 'travel' | 'socializing' | 'self-care';

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
```

---

## 5. Database Schema (SQL)

The current schema lives in `supabase/migrations/001_initial_schema.sql`. The excerpt below matches the implemented migration as of the current repo state.

```sql
-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── Personas ───
create table personas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  -- Writing preferences (how the journal sounds)
  writing_style text not null check (writing_style in ('poetic', 'casual', 'reflective', 'witty')),
  journal_topics text[] not null default '{}',
  narrative_voice text not null check (narrative_voice in ('first_person', 'second_person', 'third_person')),
  emotional_depth text not null check (emotional_depth in ('light', 'moderate', 'deep')),
  personality_tags text[] not null default '{}',
  -- Life context (who the person is)
  mbti text check (mbti in (
    'INTJ','INTP','ENTJ','ENTP',
    'INFJ','INFP','ENFJ','ENFP',
    'ISTJ','ISFJ','ESTJ','ESFJ',
    'ISTP','ISFP','ESTP','ESFP'
  )),
  occupation text check (occupation in ('student', 'professional', 'freelancer', 'between', 'skip')),
  daily_people text[] not null default '{}',
  daily_activities text[] not null default '{}',
  -- Freeform
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
  generated_content text,
  status text not null default 'generating' check (status in ('generating', 'draft', 'confirmed')),
  generated_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index idx_journal_user_day on journal_entries(user_id, day_date);

-- ─── Voice Profiles ───
create table voice_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  voice_summary text not null default '',
  preferred_phrases text[] not null default '{}',
  avoided_phrases text[] not null default '{}',
  journals_analyzed int not null default 0,
  last_refreshed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Row Level Security ───
alter table personas enable row level security;
alter table moments enable row level security;
alter table moment_photos enable row level security;
alter table journal_entries enable row level security;
alter table voice_profiles enable row level security;

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

create policy "Users own their voice profile" on voice_profiles
  for all using (auth.uid() = user_id);
```

---

## 6. Supabase Storage

### Bucket: `moment-photos`

- **Access:** Private bucket. The current production path is server-side upload/signing via the NestJS backend using the service-role client.
- **Path convention:** `{user_id}/{day_date}/{moment_id}/{filename}`
  - Example: `abc123/2026-03-20/def456/photo_001.jpg`
- **Accepted MIME types:** `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- **Max file size:** 10MB per photo.

### Runtime Storage Behavior

- `POST /api/moments` uploads files from the server to the `moment-photos` bucket and persists both `storage_path` and a signed `photo_url`.
- `photo_url` is what the client uses to render captured photos.
- `storage_path` is retained so the backend can mint fresh signed URLs for AI vision requests during journal generation.
- The vision pipeline currently creates 1-hour signed URLs from `storage_path` before sending images to GPT-4o.
- The migration file includes commented policy examples as a future starting point if direct client storage access is ever introduced, but that is **not** the current architecture.

---

## 7. Screen Specifications

All screens render inside `AuraShell`, which applies the mood-reactive aura backdrop and constrains the interactive surface to a centered mobile column.

---

### Screen 1: Auth + Post-Auth Resolver

**Routes:** `/auth`, `/auth/resolver`

**Auth screen behavior:**
- Email/password auth via Supabase `signUp` or `signInWithPassword`
- On successful auth, the client stores the user in Zustand immediately and redirects to `/auth/resolver`

**Resolver behavior:**
- Reads the current Supabase session
- Calls `GET /api/persona`
- Redirects to `/onboarding` if persona is missing, otherwise `/home`
- Uses the shared `LoadingScreen` instead of a blank route transition

---

### Screen 2: Onboarding — Persona Survey

**Route:** `/onboarding`

**Current architecture:**
- 11-step stepped survey rendered inside a surfaced card with a fixed frame and animated panel swaps
- Global reduced-motion support: step transitions collapse to opacity-only if the user prefers reduced motion
- Persona data is gathered in local component state and submitted once on the final step via `POST /api/persona`

**Implemented steps:**
1. Writing style
2. Journal topics (1–3)
3. Narrative voice
4. Emotional depth
5. Personality tags (2–4)
6. MBTI (optional / skippable)
7. Occupation
8. Daily people
9. Daily activities (up to 4)
10. Additional context (optional)
11. Hardcoded style preview generated from the chosen style + narrative voice + MBTI

---

### Screen 3: Home — Camera Hero + Gallery Page

**Route:** `/home`

**Current architecture:**
- Two vertically stacked full-height pages in one scroll-snap container
- Page one is the camera hero with:
  - live square camera preview when `getUserMedia` succeeds
  - graceful fallback panel when camera permission is denied, unsupported, or errors
  - import button, shutter button, and journal/archive button
- Page two is the gallery/activity page with:
  - queued unsaved captures
  - today's saved moments
  - a single dock CTA that becomes either `review (n)` or `start journal`

**Moment creation path:**
- The primary path is a full-screen overlay on top of `/home`
- `/moments/new` still exists as a compatibility route, but the active home flow no longer depends on route navigation for the modal

**Moment detail path:**
- Saved moments open a read-only modal with photos, time, optional note, mood, and delete action

---

### Screen 4: Moment Review + Save

**Primary path:** modal overlay on `/home`

**Current architecture:**
- Step 1: review selected photos, remove items, append more files
- Step 2: add optional mood, typed context, and/or recorded voice
- Voice capture uses browser `MediaRecorder`; stopping uploads the audio to `POST /api/transcribe`, and the returned transcript is merged into the text field
- Images are compressed client-side before upload using `compressImage`

**Save behavior:**
- Builds a multipart form with compressed photos plus optional `text_context`, `voice_transcript`, `mood`, `captured_at`, and `day_date`
- Posts to `POST /api/moments`
- Updates the Zustand moment store immediately on success
- Returns the user to the gallery page of `/home`

---

### Screen 5: Timeline Confirmation

**Route:** `/timeline`

**Current architecture:**
- Loads today's moments from Zustand first, then falls back to `GET /api/moments?date=...`
- Reorderable timeline list with delete actions
- Empty-state card when there are no moments yet

**Generate behavior:**
- Saves the ordered IDs locally
- Fires `PATCH /api/moments/reorder` in the background
- Calls `POST /api/journal/generate` with `date` and the ordered `momentIds`
- Navigates immediately to `/journal/:date` with typed route state indicating optimistic generation

---

### Screen 6: Journal View / Edit

**Route:** `/journal/:date`

**Current architecture:**
- Route-level loading uses `LoadingScreen`
- Fetches both the journal row and the day's moments
- If the page was reached optimistically from timeline and the first fetch returns `404`, the client creates a temporary local `generating` journal and starts polling
- Polling cadence: every 2 seconds, with a 30 second timeout

**States:**
- `generating`
  - shows the animated quill loader from `JournalRenderer`
  - polls `GET /api/journal/:date` until the row becomes `draft` or `confirmed`
- `draft`
  - rendered markdown with interleaved moment photos
  - sticky bottom bar with `confirm & save` and `regenerate`
- `confirmed`
  - read-only journal with stable exit CTAs (`back home`, and conditionally `archive` / `back to timeline`)
- `editing`
  - textarea editor after converting the journal back to `draft` if needed

---

### Screen 7: Journal History

**Route:** `/journals`

**Current architecture:**
- Month-scoped archive with client-side caching keyed by `yyyy-MM`
- Prefetches the current month plus the two previous months
- Uses `GET /api/journals?status=confirmed&from=...&to=...`
- Calendar dots and recent list are both driven by cached month data
- Tapping a calendar day opens a root-mounted popover stored in Zustand; the popover can retarget to another day without closing/reopening
- Recent list entries navigate to `/journal/:date` with typed route state indicating the source was `history`

---

## 8. API Routes

All routes are NestJS controller endpoints. The server runs on a separate port (for local dev, `http://127.0.0.1:3001/api`). The client calls these endpoints via the shared API client (`client/src/lib/api.ts`).

### Auth Architecture

Authentication uses a split model:
- **Client side:** Supabase Auth SDK handles login, signup, and session management. On successful auth, the client receives a Supabase JWT access token.
- **Server side:** Every API request includes the JWT as `Authorization: Bearer <token>`. A NestJS `AuthGuard` validates the token using Supabase `auth.getUser(token)` and attaches the user to the request object.
- **No cookies or server-side sessions.** The client stores the token via Supabase's built-in session persistence and sends it with every request.
- **Client request wrapper:** `client/src/lib/api.ts` retries session lookup briefly before each request, redirects to `/auth` on `401`, and clears the Zustand auth state on expiry.

```typescript
// server — auth.guard.ts (simplified)
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new UnauthorizedException();
    request.user = user;
    return true;
  }
}
```

All feature controllers use `@UseGuards(AuthGuard)` at the class level. The authenticated user is accessed via `@CurrentUser()`.

---

### `GET /api/health`

Simple health endpoint for smoke checks and local orchestration.

**Response:** `200 OK`
```json
{ "status": "ok" }
```

---

### `POST /api/persona`

Create or update the current user's persona.

**Request Body:**
```json
{
  "writing_style": "casual",
  "journal_topics": ["emotions", "events"],
  "narrative_voice": "first_person",
  "emotional_depth": "moderate",
  "personality_tags": ["coffee-lover", "overthinker"],
  "mbti": "INFP",
  "occupation": "student",
  "daily_people": ["close-friends", "family"],
  "daily_activities": ["work-school", "cooking", "side-projects"],
  "additional_context": "I'm Tan, a CS student who lives on cà phê sữa đá."
}
```

**Response:** `201 Created` — returns the `Persona` object.

**Logic:** Upsert into `personas` table (unique on `user_id`).

---

### `GET /api/persona`

Fetch the current user's persona, or `null` if onboarding has not been completed yet.

**Response:** `200 OK` — `Persona | null`

---

### `GET /api/moments?date=YYYY-MM-DD`

Fetch all moments for a given day, with their photos.

**Response:** `200 OK` — `MomentWithPhotos[]`, ordered by `order_index`.

---

### `POST /api/moments`

Create a new moment.

**Request:** `multipart/form-data`
- `photos`: File[] (1 or more image files)
- `text_context`: string (optional)
- `voice_transcript`: string (optional)
- `mood`: string (optional)
- `captured_at`: string (ISO 8601, optional — defaults to now)
- `day_date`: string (YYYY-MM-DD, optional — defaults to today)

**Response:** `201 Created` — returns `MomentWithPhotos`.

**Logic:**
1. Determine `order_index` = count of existing moments for this user+day.
2. Upload each photo to Supabase Storage at `{user_id}/{day_date}/{moment_id}/{index}.jpg`.
3. Create signed read URLs and persist them as `photo_url`.
4. Insert `moments` row + `moment_photos` rows.
5. Return the assembled object.

---

### `DELETE /api/moments/:id`

Delete a moment and its photos.

**Response:** `204 No Content`.

**Logic:** Delete from `moments` (cascade deletes photo rows) and delete the uploaded files from the storage bucket.

---

### `PATCH /api/moments/reorder`

Update the order of moments for a day.

**Request Body:**
```json
{
  "date": "2026-03-20",
  "order": ["moment-uuid-1", "moment-uuid-3", "moment-uuid-2"]
}
```

**Response:** `200 OK`.

**Logic:** For each moment ID in the array, set `order_index` = array index.

---

### `POST /api/transcribe`

Transcribe voice audio to text.

**Request:** `multipart/form-data`
- `audio`: File (webm, mp4, wav, etc.)

**Response:** `200 OK`
```json
{
  "transcript": "I just had the best pho for lunch at that place near District 7."
}
```

**Logic:**
- Use OpenAI `audio.transcriptions.create` with model `whisper-1` when OpenAI is configured.
- If OpenAI is unavailable or misconfigured, fall back to a deterministic transcript string derived from the uploaded file.

---

### `POST /api/journal/generate`

Trigger journal generation for a day.

**Request Body:**
```json
{
  "date": "2026-03-20",
  "regenerate": false,
  "momentIds": ["moment-uuid-1", "moment-uuid-3", "moment-uuid-2"]
}
```

**Response:** `202 Accepted`
```json
{
  "journal_id": "uuid",
  "status": "generating"
}
```

**Logic summary:**
1. Upsert `journal_entries` with status `generating`.
2. Return immediately.
3. Continue the AI pipeline in the background.
4. Reorder moments by `momentIds` if provided.
5. Persist the result as `draft` with `content` and `generated_content` on success.
6. On unrecoverable failure, persist the failure placeholder in a `draft` row.

---

### `GET /api/journal/:date`

Fetch the journal entry for a specific date.

**Response:** `200 OK` — `JournalEntry`

**Errors:** `404` when no row exists for that date.

---

### `PATCH /api/journal/:date`

Update journal content or status.

**Request Body:**
```json
{
  "content": "Updated markdown content...",
  "status": "confirmed"
}
```

**Response:** `200 OK` — updated `JournalEntry`.

**Logic:**
- If status becomes `confirmed`, set `confirmed_at = now()`
- If the user edits content and `generated_content` is available, preserve the original AI draft so later voice learning can compare AI output against the user's final version

---

### `GET /api/journals`

List all journal entries for the current user.

**Query Params:**
- `limit` (default 30)
- `offset` (default 0)
- `status` (optional filter: `draft` | `confirmed`)
- `from` (optional inclusive lower date bound)
- `to` (optional inclusive upper date bound)

**Response:** `200 OK` — entries ordered by `day_date` DESC, each including all `JournalEntry` fields plus `first_photo_url` for archive thumbnails.

---

## 9. AI Pipeline — Journal Generation

This is the most critical system in the app. The quality of the generated journal is the product, but the implementation is intentionally resilient: the pipeline should still complete with deterministic fallback output when OpenAI is unavailable.

### Generation Request Lifecycle

When `POST /api/journal/generate` is called:

#### Step 1: Create / update the journal row

- Upsert `journal_entries(user_id, day_date)` with status `generating`
- Return `202 Accepted` immediately with `{ journal_id, status: "generating" }`
- Continue the actual generation work in `runGenerationPipeline(...)` without blocking the HTTP response

#### Step 2: Gather context

Fetch in parallel:
- **Persona** from `personas`
- **Today's moments** from `moments` + `moment_photos`
- **Recent confirmed journals** (up to 7) for continuity
- **Voice profile** from `voice_profiles` if present
- **Recent edit diffs** from confirmed journals where `generated_content !== content`

If `momentIds` were supplied by the timeline, reorder the fetched moments to match the exact client-side sequence before prompt assembly.

#### Step 3: Describe photos

For each moment:
- Create fresh 1-hour signed URLs from each `storage_path`
- Send those URLs to GPT-4o vision with the shared photo prompt when OpenAI is configured
- If OpenAI is unavailable or misconfigured, fall back to deterministic descriptions such as `"A single photo was captured for this moment."`

#### Step 4: Assemble the prompt

The system prompt combines:
- persona writing preferences
- persona life context
- recent confirmed journal excerpts
- learned voice profile summary and preferred / avoided phrases
- recent edit corrections distilled from `generated_content` vs confirmed `content`

The user message enumerates the ordered moments:
- formatted capture time
- optional mood
- photo descriptions
- merged typed notes + voice transcript

The current prompt adds two important calibration layers beyond the original MVP:
- learned voice profile is treated as the highest-priority voice signal when available
- recent edit corrections are treated as explicit examples of what the user rejected vs preferred

#### Step 5: Generate the journal body

- Primary path: OpenAI `chat.completions.create` with model `gpt-4o`
- Temperature: `0.8`
- Max tokens: `1500`
- Fallback path: deterministic journal assembly using the persona voice, ordered moments, mood, notes, and fallback photo descriptions

#### Step 6: Persist the result

On success:
- update `content`
- update `generated_content` to the same initial AI draft when the schema supports it
- set `status = 'draft'`
- set `generated_at = now()`

On unrecoverable failure:
- mark the row as `draft`
- set `content = "Generation failed — tap Regenerate to try again."`

#### Step 7: Refresh voice profile in the background

After a successful generation, the service triggers a non-blocking voice-profile refresh check:
- count confirmed journals
- if there are at least 5 more confirmed journals than the last analyzed count, distill a new voice profile with GPT-4o
- persist `voice_summary`, `preferred_phrases`, `avoided_phrases`, and `journals_analyzed`

### Edit-Diff Learning Loop

- `generated_content` stores the original AI draft
- if the user edits and confirms the journal, the server preserves the untouched original draft when possible
- later generations can inject the most recent edit diffs as examples of what the user kept vs changed

### Graceful Degradation

- If OpenAI is misconfigured, `OpenaiService` disables the client and the app falls back to deterministic journal / vision / transcription behavior instead of crashing
- If the `generated_content` column or `voice_profiles` table is missing, the services log warnings and continue in a reduced-capability mode rather than failing the entire generation request

---

## 10. Data Flow Diagrams

### Flow A: Moment Capture

```
User captures or imports photos on /home
        │
        ▼
Files enter the local capture queue
        │
        ▼
Home opens the moment form overlay
  ├─ Optional: select mood
  ├─ Optional: type text context
  └─ Optional: record voice → POST /api/transcribe → transcript
        │
        ▼
User taps "Save Moment"
        │
        ▼
Client compresses photos
        │
        ▼
POST /api/moments
  ├─ Insert moments row
  ├─ Upload photos to Supabase Storage
  └─ Insert moment_photos rows
        │
        ▼
Update Zustand + return to the gallery page on /home
```

### Flow B: Journal Generation

```
User taps "start journal" from the gallery page on /home
        │
        ▼
[Screen 5: Timeline Confirmation]
  ├─ Moments displayed in order
  └─ User can drag to reorder
        │
        ▼
User taps "Done — Generate"
        │
        ├─ Fire PATCH /api/moments/reorder in the background
        ├─ POST /api/journal/generate with date + ordered momentIds
        └─ Navigate immediately to /journal/:date with optimistic route state
        │
        ▼
[Screen 6: Journal View]
  ├─ First fetch may see generating row or transient 404
  ├─ Poll GET /api/journal/:date every 2s
  ├─ When draft arrives, render markdown + photos
  ├─ User reads generated journal
  ├─ Optional: edit content
  ├─ Optional: regenerate
  └─ Confirm & Save → status: confirmed
        │
        ▼
Background voice-profile refresh may run after enough confirmed journals accumulate
```

### Flow C: First-Time User

```
User visits app
        │
        ▼
/auth — Sign up / Log in
        │
        ▼
Set auth state locally
        │
        ▼
/auth/resolver
        │
        ├─ GET /api/persona returns null  → /onboarding
        └─ GET /api/persona returns row   → /home
```

---

## 11. Project File Structure

```text
journie/
├── client/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── e2e/                          # Playwright coverage for core flows and regressions
│   │   ├── helpers/
│   │   └── *.spec.ts
│   └── src/
│       ├── main.tsx                  # LazyMotion + MotionConfig wrapper
│       ├── App.tsx                   # Router, protected routes, lazy page loading
│       ├── index.css
│       ├── pages/
│       │   ├── auth.tsx
│       │   ├── post-auth-resolver.tsx
│       │   ├── onboarding.tsx
│       │   ├── home.tsx
│       │   ├── moment-detail.tsx     # Compatibility route for /moments/new
│       │   ├── timeline.tsx
│       │   ├── journal-view.tsx
│       │   └── journal-history.tsx
│       ├── components/
│       │   ├── camera-capture.tsx
│       │   ├── home-gallery-page.tsx
│       │   ├── loading-screen.tsx
│       │   ├── moment-form.tsx
│       │   ├── timeline-list.tsx
│       │   ├── journal-renderer.tsx
│       │   ├── calendar-view.tsx
│       │   ├── calendar-day-popover.tsx
│       │   ├── layout/
│       │   │   └── AuraShell.tsx
│       │   └── ui/
│       │       ├── action-button.tsx
│       │       └── horizontal-scroll-strip.tsx
│       ├── lib/
│       │   ├── api.ts
│       │   ├── supabase.ts
│       │   ├── store.ts
│       │   ├── motion.ts
│       │   ├── route-preloaders.ts
│       │   ├── journal-navigation.ts
│       │   ├── use-prefers-reduced-motion.ts
│       │   └── utils.ts
│       └── types/
│           └── index.ts              # Re-export from shared/types.ts
├── server/
│   ├── package.json
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── ai/
│       │   ├── ai.module.ts
│       │   └── openai.service.ts
│       ├── common/
│       │   ├── common.module.ts
│       │   ├── health.controller.ts
│       │   ├── guards/
│       │   │   └── auth.guard.ts
│       │   ├── decorators/
│       │   │   └── current-user.ts
│       │   └── supabase/
│       │       └── supabase.service.ts
│       ├── persona/
│       ├── moments/
│       ├── transcribe/
│       ├── journal/
│       │   ├── journal.controller.ts
│       │   ├── journal.service.ts
│       │   ├── dto/
│       │   └── generation/
│       │       ├── generation.service.ts
│       │       ├── vision.service.ts
│       │       ├── voice-profile.service.ts
│       │       └── prompts.ts
│       └── types/
│           └── index.ts
├── shared/
│   └── types.ts
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── scripts/
│   ├── dev.ps1                       # Windows-safe local dev entrypoint
│   └── dev-client.ps1
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### Root `package.json` Scripts

```json
{
  "scripts": {
    "dev": "pwsh -NoProfile -File scripts/dev.ps1",
    "dev:client": "pnpm --filter client dev",
    "dev:server": "pnpm --filter server start:dev",
    "build:client": "pnpm --filter client build",
    "build:server": "pnpm --filter server build",
    "build": "pnpm build:client && pnpm build:server",
    "test:e2e": "pnpm --filter client test:e2e",
    "test:smoke": "pnpm --filter client test:e2e:smoke"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'client'
  - 'server'
```

---

## 12. Environment Variables

### Client (`client/.env`)

```env
# Supabase (public, safe for browser)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Backend API
VITE_API_URL=http://127.0.0.1:3001/api
```

`VITE_API_URL` is optional in development; the client defaults to `/api` if it is omitted. `VITE_` prefix = exposed to the browser via Vite. Only public keys go here.

### Server (`server/.env`)

```env
# Supabase (server-side, secret)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # Full DB access, never expose to client

# OpenAI
OPENAI_API_KEY=sk-...

# Server config
HOST=127.0.0.1
PORT=3001
CLIENT_URL=http://127.0.0.1:5173      # For CORS allowlist
```

All server env vars are secret. None are exposed to the browser.

---

## 13. MVP Scope — What to Build vs. Skip

### Build (hackathon MVP)

- [x] Supabase auth (email/password)
- [x] Persona survey (11 steps + hardcoded voice preview)
- [x] Home screen with live camera, library import, and below-the-fold gallery page
- [x] Moment review overlay with photos + text context + mood
- [x] Voice recording → Whisper transcription
- [x] Timeline confirmation with drag-to-reorder
- [x] AI journal generation (async pipeline with deterministic fallback path)
- [x] Journal view + edit + confirm + regenerate
- [x] Journal history with month-scoped calendar archive + day popover
- [x] Voice-profile learning from confirmed journals and edit diffs

### Skip (post-hackathon)

- [ ] OAuth login (Google, Apple)
- [ ] Auto-generation at end of day (cron job)
- [ ] Push notifications ("You haven't captured any moments today!")
- [ ] Journal export (PDF)
- [ ] Mood/sentiment analytics over time
- [ ] Sharing journals with friends/family
- [ ] ElevenLabs read-back of journal
- [ ] Desktop-optimized layout
- [ ] Photo editing/cropping before upload

---

## 13.5. Error Handling & Resilience (MVP)

These are minimum error handling requirements for the hackathon build:

### Client-Side
- **All API calls** must show a toast (via `sonner`) on failure with a human-readable message. Never show raw error objects.
- **Photo upload failures:** Show "Upload failed, tap to retry" on the affected photo thumbnail. Don't lose the user's other form inputs.
- **Auth token expiry:** If any API call returns 401, redirect to `/auth` and clear local session state.
- **Network offline:** Show a top banner "You're offline" when `navigator.onLine` is false. Disable destructive actions (save, generate). Re-enable automatically when back online.

### Server-Side
- **OpenAI failures:** Vision, transcription, and journal generation all degrade gracefully. If OpenAI is unavailable or misconfigured, the app falls back to deterministic photo descriptions, transcripts, and journal text instead of hard failing.
- **Unrecoverable generation failures:** Set journal status to `draft` with `content = "Generation failed — tap Regenerate to try again."` so the user isn't stuck on a `generating` spinner forever.
- **Supabase Storage failures:** Return 500 with `{ error: "Photo upload failed" }`. The client retries.
- **Rate limiting on `/api/journal/generate`:** Max 3 generation requests per user per day per date. Return 429 if exceeded. This prevents accidental OpenAI credit burn from spam-tapping "Regenerate".
- **Schema drift protection:** If `generated_content` or `voice_profiles` is missing, the server logs warnings and continues in reduced-capability mode instead of failing the request.

### General
- Never silently swallow errors. Log all server-side errors with enough context to debug (user_id, endpoint, error message).
- All loading states must have a timeout — if an operation hasn't completed in 30 seconds, show "Something went wrong" with a retry option.

---

## 15. Hackathon Demo Strategy

Since the team will use the app throughout the hackathon as the demo itself:

1. **Day 0 (setup night):** Each team member completes persona survey with genuinely different styles (one casual, one poetic, one reflective). This showcases personalization during the demo.
2. **Day 1–2 (building):** Capture real moments — coding sessions, meals, whiteboard discussions, coffee runs. The more genuine the photos, the better the demo.
3. **Demo:** Show a real generated journal from the hackathon itself. Pull up the calendar, show 2–3 days of entries, read one aloud. The journal IS the pitch.

This is the strongest possible demo: a product that demonstrates itself through its own output.

