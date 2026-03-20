# Journie — Architecture Document

> **Purpose of this document:** This is the single source of truth for the entire application. Any AI agent or human developer building any part of this app should read this document first and treat it as the canonical reference. If code conflicts with this doc, the doc wins.

---

## 1. Project Overview

**Journie** is a mobile-first web app that generates a personal daily journal from photos and optional voice/text context captured throughout the day. The user never writes a journal entry — they just live their day, capture moments, and the AI writes their journal for them in their personal voice.

### Core Loop

1. User completes a one-time **persona survey** (60 seconds) so the AI knows their writing style and personality.
2. Throughout the day, user creates **moments** — each moment is a batch of one or more photos plus optional text or voice context.
3. When the user is done for the day, they hit **"Start Journaling"** → confirm the timeline order of moments → hit **"Done"**.
4. The AI generates a journal entry for that day, drawing on: the persona, all moments (photos + context), and past journal history.
5. User reviews, optionally edits, and confirms. The journal is saved.

### Key Design Principles

- **Photo-first, write-nothing:** The camera is the primary input. Text and voice are always optional.
- **Low friction:** Every interaction should feel like 2–3 taps max.
- **Personal voice:** The generated journal should read as if the user wrote it on their best day — specific, emotional, never generic.
- **Mobile-first:** All layouts are designed for phones. Desktop is a nice-to-have, not a target.

---

## 2. Conventions & Agent Instructions

### Architecture

This is a **monorepo** with two separate applications:
- `client/` — React + Vite + Tailwind CSS (frontend SPA)
- `server/` — NestJS (backend REST API)

They communicate over HTTP. The client calls the server's REST API. They are developed, built, and deployed independently but live in one repo.

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
- Mobile-first responsive: design at `375px` width, scale up.
- All async operations should show loading states and handle errors gracefully.
- Use Zustand for global client state (today's moments, auth state).

### Code Style — Server (NestJS)

- Use TypeScript strict mode. No `any` types.
- Follow NestJS module architecture: each feature has its own module, controller, service, and DTOs.
- Controllers handle HTTP concerns only (parse request, return response). Business logic lives in services.
- Use `class-validator` and `class-transformer` for DTO validation.
- Use NestJS Guards for authentication (validate Supabase JWT on every request).
- Use NestJS Interceptors for response transformation if needed.
- All Supabase DB queries go through services, using the Supabase JS client with the service role key.
- All OpenAI calls go through dedicated service classes.

### Component Architecture (Client)

- `components/ui/` — reusable primitives (Button, Input, Modal, etc.)
- `components/` — feature-specific components (MomentCard, PersonaSurvey, JournalViewer, etc.)
- `pages/` — route-level page components (one per screen)
- Keep components small. If a component exceeds ~150 lines, split it.

---

## 3. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 18 + Vite | Fast dev server, SPA with client-side routing |
| Routing (client) | React Router v6 | Declarative routing for SPA |
| Styling | Tailwind CSS | Utility-first, fast iteration, mobile-first |
| Client State | Zustand | Lightweight global state for moments, auth |
| **Backend** | NestJS | Modular, decorator-based, TypeScript-native, scalable |
| Auth | Supabase Auth (client SDK) + NestJS Guard (JWT validation) | Client handles login/signup, server validates tokens |
| Database | Supabase (PostgreSQL) | Relational, row-level security, real-time |
| File Storage | Supabase Storage | S3-compatible, integrated auth policies |
| AI — Vision + Text | OpenAI GPT-4o | Multimodal (image + text in one call) |
| AI — Voice Transcription | OpenAI Whisper API | High accuracy, simple API |
| Deployment | AWS (Amplify static for client, Amplify compute or EC2 for server) | Aligns with AWS sponsor track |
| Package Manager | pnpm | Fast, disk-efficient, good monorepo support |

### Key Dependencies — Client (`client/package.json`)

```json
{
  "react": "^18",
  "react-dom": "^18",
  "react-router-dom": "^6",
  "@supabase/supabase-js": "^2",
  "zustand": "^4",
  "tailwindcss": "^3",
  "lucide-react": "^0.300",
  "date-fns": "^3",
  "sonner": "^1",
  "vite": "^5"
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

These are the canonical types. All frontend components and API routes import from `/src/types/index.ts`.

```typescript
// /src/types/index.ts

// ─── User & Persona ───

export interface User {
  id: string;                // Supabase auth UID
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;        // ISO 8601
}

export interface Persona {
  id: string;                // UUID
  user_id: string;           // FK → User.id
  // Writing preferences (how the journal sounds)
  writing_style: WritingStyle;
  journal_topics: JournalTopic[];
  narrative_voice: NarrativeVoice;
  emotional_depth: EmotionalDepth;
  personality_tags: PersonalityTag[];
  // Life context (who the person is)
  mbti: MBTIType | null;
  occupation: Occupation | null;
  daily_people: DailyPerson[];
  daily_activities: DailyActivity[];
  // Freeform
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
  id: string;                // UUID
  user_id: string;           // FK → User.id
  day_date: string;          // YYYY-MM-DD, the day this moment belongs to
  order_index: number;       // position in the day's timeline (0-based)
  text_context: string | null;       // optional text the user typed
  voice_transcript: string | null;   // optional transcribed voice input
  mood: Mood | null;                 // optional mood tag
  captured_at: string;       // ISO 8601 — when the moment was created
  created_at: string;
}

export type Mood = 'great' | 'good' | 'neutral' | 'low' | 'rough';

export interface MomentPhoto {
  id: string;                // UUID
  moment_id: string;         // FK → Moment.id
  storage_path: string;      // path in Supabase Storage bucket
  photo_url: string;         // public or signed URL
  order_index: number;       // order within the moment
  created_at: string;
}

// ─── Journal ───

export interface JournalEntry {
  id: string;                // UUID
  user_id: string;           // FK → User.id
  day_date: string;          // YYYY-MM-DD — one entry per day
  content: string;           // markdown-formatted journal text
  status: JournalStatus;
  generated_at: string;      // when AI generation completed
  confirmed_at: string | null; // when user confirmed
  created_at: string;
  updated_at: string;
}

export type JournalStatus = 'generating' | 'draft' | 'confirmed';

// ─── Aggregated Types (not stored, assembled at query time) ───

export interface MomentWithPhotos extends Moment {
  photos: MomentPhoto[];
}

export interface DayTimeline {
  date: string;              // YYYY-MM-DD
  moments: MomentWithPhotos[];
  journal: JournalEntry | null;
}
```

---

## 5. Database Schema (SQL)

Run this in the Supabase SQL editor to set up all tables.

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
  status text not null default 'generating' check (status in ('generating', 'draft', 'confirmed')),
  generated_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One journal entry per user per day
create unique index idx_journal_user_day on journal_entries(user_id, day_date);

-- ─── Row Level Security ───
alter table personas enable row level security;
alter table moments enable row level security;
alter table moment_photos enable row level security;
alter table journal_entries enable row level security;

-- Users can only access their own data
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
```

---

## 6. Supabase Storage

### Bucket: `moment-photos`

- **Access:** Private. Authenticated users can upload/read their own photos only.
- **Path convention:** `{user_id}/{day_date}/{moment_id}/{filename}`
  - Example: `abc123/2026-03-20/def456/photo_001.jpg`
- **Accepted MIME types:** `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- **Max file size:** 10MB per photo.

### Storage Policy (SQL)

```sql
-- Allow users to upload to their own folder
create policy "Users upload own photos"
on storage.objects for insert
with check (
  bucket_id = 'moment-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own photos
create policy "Users read own photos"
on storage.objects for select
using (
  bucket_id = 'moment-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## 7. Screen Specifications

Each screen is described in terms of: route, layout, key UI elements, user actions, and data dependencies. All screens assume a mobile viewport (375px wide) with a safe-area-aware layout.

---

### Screen 1: Auth (Login / Signup)

**Route:** `/auth`

**Layout:** Centered card with app logo at top, form below.

**UI Elements:**
- App logo + tagline: "Your day, your journal, zero writing."
- Email input field
- Password input field
- "Sign Up" primary button
- "Log In" secondary text link (toggles form mode)

**Behavior:**
- On successful auth, check if persona exists for user.
  - If no persona → redirect to `/onboarding`
  - If persona exists → redirect to `/home`
- Use Supabase Auth `signUp` / `signInWithPassword`.

**Data:** None pre-loaded.

---

### Screen 2: Onboarding — Persona Survey

**Route:** `/onboarding`

**Layout:** Full-screen stepped flow. One question per step. Progress bar at top (11 dots). Large tap-friendly option cards. "Next" button at bottom (disabled until selection made). "Back" button on steps 2+. Each step animates in with a subtle left-slide.

**Steps:**

**Part A — Writing preferences (how the journal sounds)**

1. **Writing style** — "How should your journal sound?"
   - Options displayed as cards with a sample sentence each:
     - ✨ **Poetic** — "The morning light whispered through the curtains..."
     - 💬 **Casual** — "Grabbed coffee, hit the gym, pretty solid morning."
     - 🪞 **Reflective** — "I noticed something shift in me today..."
     - 😏 **Witty** — "Survived another Monday. Barely. The coffee deserves a medal."
   - Single select. Tapping a card highlights it with accent-400 border.

2. **Journal topics** — "What matters to you?" (multi-select, pick 1–3)
   - Options as tappable pills: Emotions, Events, Growth, Relationships, Ideas, Gratitude
   - Selected pills fill with accent-200 bg, accent-400 border.

3. **Narrative voice** — "How do you talk to yourself?"
   - Options as cards with example text:
     - First person: "I went to the park..."
     - Second person: "You went to the park..."
     - Third person: "She went to the park..."
   - Single select.

4. **Emotional depth** — "How deep should we go?"
   - Light: "Just the highlights, keep it breezy."
   - Moderate: "Some feelings, some facts."
   - Deep: "I want to actually reflect."
   - Single select.

5. **Personality tags** — "Pick what fits you" (multi-select, pick 2–4)
   - Options as tappable pills in a flowing wrap layout:
     - Introvert, Extrovert, Night owl, Early bird, Coffee lover, Foodie, Tech nerd, Creative, Adventurous, Homebody, Overthinker, Optimist
   - Multi-select with max 4. After 4 selected, remaining pills dim to cream-300.

**Part B — Life context (who the person is)**

6. **MBTI** — "What's your MBTI type?"
   - 4×4 grid of tappable pills (INTJ, INTP, ENTJ, ENTP, INFJ, INFP, ENFJ, ENFP, ISTJ, ISFJ, ESTJ, ESFJ, ISTP, ISFP, ESTP, ESFP).
   - Each pill: cream-100 bg, rounded-full, font-sans 13px bold.
   - Selected: accent-400 bg, white text.
   - "I don't know / skip" text link below the grid.
   - Single select.

7. **Occupation** — "What do you do?"
   - Options as tappable cards:
     - 🎓 **Student**
     - 💼 **Working professional**
     - 🎨 **Freelancer / creative**
     - 🌊 **Between things right now**
     - 🤐 **Rather not say**
   - Single select.

8. **Daily people** — "Who's usually in your day?" (multi-select)
   - Options as tappable pills:
     - Partner/spouse, Close friends, Family, Coworkers/classmates, Mostly solo, Pets
   - Multi-select. Selected pills fill with accent-200.

9. **Daily activities** — "What fills your days lately?" (multi-select, pick up to 4)
   - Options as tappable pills in a flowing wrap layout:
     - Work/school, Cooking/eating out, Exercise/sports, Reading/learning, Music/art, Gaming, Nature/outdoors, Coffee/café culture, Side projects, Travel, Socializing, Self-care
   - Multi-select with max 4. After 4 selected, remaining pills dim to cream-300.

**Final step — Freeform + confirmation**

10. **Additional context (optional)** — "Tell the AI anything else — your name, your vibe, your current life chapter."
   - Textarea, placeholder: "e.g., I'm Tan, a CS student who lives on cà phê sữa đá and late-night coding sessions. Currently in my 'figuring it all out' era."
   - "Skip" button visible.

11. **Style preview** — Show a 3-sentence sample journal entry generated on-the-fly using the user's chosen writing style, voice, and MBTI context. "This is how your journal will sound." with a "Looks good, let's go!" CTA button.

**Behavior:**
- On "Looks good, let's go!": POST persona to DB, redirect to `/home`.
- If user navigates away mid-survey, progress is lost (no draft saving for MVP).
- The style preview (step 11) uses a hardcoded sample — not a real AI call — to avoid latency. Map writing_style × narrative_voice to pre-written sample paragraphs.
- Back button goes to previous step.
- Progress bar shows steps 1–11.

**Data written:** `personas` table — one row per user.

---

### Screen 3: Home (Capture Hub)

**Route:** `/home`

**Layout:** This is the core screen. Mobile-first, inspired by Locket's camera-centric UI.

**UI Elements — Top Bar:**
- Left: greeting — "Good [morning/afternoon/evening], {display_name}"
- Right: "My Journal" button (icon: book) → navigates to `/journals`

**UI Elements — Main Area:**
- Large camera viewfinder preview (takes up ~60% of screen height)
- Below the viewfinder:
  - **Capture button** (large circle, center) — takes a photo using device camera
  - **Library button** (small, bottom-left of capture row) — opens device photo picker for importing from library
- Below capture row:
  - Scrollable horizontal row of **today's moments** as thumbnail cards
  - Each card shows: first photo thumbnail, time, mood emoji if set
  - Tapping a card opens the moment detail view (read-only, with option to delete)

**UI Elements — Bottom:**
- **"Start Journaling"** button — prominent CTA, fixed at bottom
  - Only appears if there is at least 1 moment for today
  - Navigates to `/timeline`

**Camera Implementation:**
- Use `<input type="file" accept="image/*" capture="environment">` for the capture button (opens native camera).
- Use `<input type="file" accept="image/*" multiple>` for the library button (opens photo picker, allows multi-select).
- After photo(s) are selected/taken, immediately navigate to the **Moment Creation Flow** (Screen 4).

**Data loaded:**
- Today's moments: `GET /api/moments?date={today}`
- User persona (for greeting): from Supabase auth session + persona cache

---

### Screen 4: Moment Creation Flow

**Route:** `/moments/new` (or modal overlay on `/home`)

**Trigger:** Activated after the user takes a photo or selects photos from library.

**Layout:** Bottom sheet or full-screen overlay.

**Step 4a: Photo Review**
- Grid display of the photo(s) just captured/selected.
- "Add more photos" button (opens camera/library again, appends to this moment).
- "Next" button.

**Step 4b: Context & Mood (optional)**
- **Mood selector** — horizontal row of 5 tappable emoji:
  - 🤩 Great | 😊 Good | 😐 Neutral | 😔 Low | 😣 Rough
  - Default: none selected. Tapping one selects it (tapping again deselects).
- **Text input** — expandable textarea.
  - Placeholder: "What's happening?" (optional)
- **Voice input button** (microphone icon)
  - On tap: starts recording via browser `MediaRecorder` API.
  - On stop: sends audio to `/api/transcribe` (Whisper), returns text, populates textarea.
  - Shows recording indicator (pulsing red dot + duration counter).
- **"Save Moment"** button.

**Behavior:**
- On "Save Moment":
  1. **Client-side image compression:** Before uploading, resize photos to max 1920px on the longest edge and compress to JPEG quality 0.8 using `<canvas>`. This reduces typical phone photos from 5–8MB to ~200–400KB, making uploads fast and storage cheap.
  2. Upload compressed photos to Supabase Storage → get URLs.
  3. POST to `/api/moments` with: photos, text_context, voice_transcript, mood, captured_at.
  4. Navigate back to `/home`. New moment appears in the today's moments row.

**Data written:** `moments` + `moment_photos` tables.

---

### Screen 5: Timeline Confirmation

**Route:** `/timeline`

**Trigger:** User taps "Start Journaling" on Home.

**Layout:** Vertical scrollable list, resembling a timeline.

**UI Elements:**
- Header: "Your day — {formatted date}"
- Vertical timeline line running down the left side.
- Each moment is a card positioned along the timeline:
  - Timestamp (from `captured_at`)
  - Thumbnail of first photo
  - Mood emoji (if set)
  - Snippet of text_context (if any), truncated to 1 line
- **Reorder:** Each card has a drag handle (≡ icon) on the right. User can long-press and drag to reorder.
  - On drop: update `order_index` for affected moments.
- **Delete:** Swipe left on a card to reveal delete option.

**Bottom Bar:**
- "Done — Generate My Journal" button (primary CTA)

**Behavior:**
- On "Done":
  1. PATCH `/api/moments/reorder` with the final order.
  2. POST `/api/journal/generate` with `{ date: "YYYY-MM-DD" }`.
  3. Navigate to `/journal/{date}` which shows a loading/generation state.

**Data loaded:** Today's moments with photos.
**Data written:** Updated `order_index` values; new `journal_entries` row with status `generating`.

---

### Screen 6: Journal View / Edit

**Route:** `/journal/[date]`

**Layout:** Full-screen reading view, clean typography.

**UI Elements — Generation State (`status === 'generating'`):**
- Animated loading indicator (e.g., a pen writing animation or pulsing dots)
- Text: "Writing your journal..."
- The generation typically takes 5–15 seconds. Poll `/api/journal/{date}` every 2 seconds or use Supabase real-time subscription on `journal_entries` table.

**UI Elements — Draft State (`status === 'draft'`):**
- **Date header:** "March 20, 2026 — Thursday"
- **Journal content:** Rendered markdown. Includes references to moments' photos inline (displayed as embedded images within the text flow).
- **Edit button** (pencil icon, top-right) → switches content to an editable markdown textarea.
- **"Confirm & Save"** button at bottom.
- **"Regenerate"** button (small, secondary) — re-triggers generation with same context.

**UI Elements — Confirmed State (`status === 'confirmed'`):**
- Same as draft but read-only.
- "Edit" button still available (sets status back to `draft`).

**Behavior:**
- On "Confirm & Save": PATCH `/api/journal/{date}` with `{ status: 'confirmed', content: currentContent }`.
- On "Regenerate": POST `/api/journal/generate` with `{ date, regenerate: true }`.

**Data loaded:** `journal_entries` row for the date + all moments with photos for inline display.

---

### Screen 7: Journal History

**Route:** `/journals`

**Layout:** Calendar-based view.

**UI Elements:**
- **Monthly calendar grid** at top. Days with confirmed journals are highlighted (accent color dot).
- Tapping a highlighted day navigates to `/journal/{date}`.
- Below the calendar: **scrollable list** of recent journal entries, newest first.
  - Each card: date, first line of content (truncated), first photo thumbnail from that day.
- Empty state: "No journals yet. Start capturing moments!"

**Data loaded:** `journal_entries` (all for current user, paginated) + first photo of each day's first moment for thumbnails.

---

## 8. API Routes

All routes are NestJS controller endpoints. The server runs on a separate port (e.g., `http://localhost:3001/api`). The client calls these endpoints via the shared API client (`client/src/lib/api.ts`).

### Auth Architecture

Authentication uses a split model:
- **Client side:** Supabase Auth SDK handles login, signup, and session management. On successful auth, the client receives a Supabase JWT access token.
- **Server side:** Every API request includes the JWT as `Authorization: Bearer <token>`. A NestJS `AuthGuard` validates the token using Supabase's `auth.getUser(token)` method and attaches the user to the request object.
- **No cookies or server-side sessions.** The client stores the token via Supabase's built-in session persistence and sends it with every request.

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

All controllers use `@UseGuards(AuthGuard)` at the class level. The authenticated user is accessed via `@Req() req` → `req.user`.

---

### `POST /api/persona`

Create or update the user's persona.

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
3. Get public URLs.
4. Insert `moments` row + `moment_photos` rows.
5. Return the assembled object.

---

### `DELETE /api/moments/[id]`

Delete a moment and its photos.

**Response:** `204 No Content`.

**Logic:** Delete from `moments` (cascade deletes photos rows). Also delete files from storage bucket.

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

Transcribe voice audio to text using OpenAI Whisper.

**Request:** `multipart/form-data`
- `audio`: File (webm, mp4, wav, etc.)

**Response:** `200 OK`
```json
{
  "transcript": "I just had the best pho for lunch at that place near District 7."
}
```

**Logic:** Forward audio file to OpenAI `audio/transcriptions` endpoint with model `whisper-1`.

---

### `POST /api/journal/generate`

Trigger journal generation for a day.

**Request Body:**
```json
{
  "date": "2026-03-20",
  "regenerate": false
}
```

**Response:** `202 Accepted`
```json
{
  "journal_id": "uuid",
  "status": "generating"
}
```

**Logic:** This is the core AI pipeline. See Section 9 for full details. Summary:
1. Create `journal_entries` row with status `generating` (or update if `regenerate: true`).
2. Trigger generation (can just `await` inline since this is a hackathon).
3. On completion, update row with `content` and set status to `draft`.

---

### `GET /api/journal/[date]`

Fetch the journal entry for a specific date.

**Response:** `200 OK` — `JournalEntry` object. Returns `404` if no entry exists.

---

### `PATCH /api/journal/[date]`

Update journal content or status.

**Request Body:**
```json
{
  "content": "Updated markdown content...",
  "status": "confirmed"
}
```

**Response:** `200 OK` — updated `JournalEntry`.

**Logic:** If status is being set to `confirmed`, also set `confirmed_at = now()`.

---

### `GET /api/journals`

List all journal entries for the current user.

**Query Params:**
- `limit` (default 30)
- `offset` (default 0)
- `status` (optional filter: `draft` | `confirmed`)

**Response:** `200 OK` — `JournalEntry[]` ordered by `day_date` DESC. Also includes a `first_photo_url` field (fetched via join) for each entry to show thumbnails.

---

## 9. AI Pipeline — Journal Generation

This is the most critical system in the app. The quality of the generated journal IS the product.

### Step-by-step Process

When `POST /api/journal/generate` is called:

#### Step 1: Gather Context

Fetch from DB:
- **Persona:** the user's `personas` row
- **Today's moments:** all moments for the date, ordered by `order_index`, with photos
- **Recent journals:** the last 3 confirmed journal entries (for continuity and voice calibration)

#### Step 2: Process Photos with Vision

For each moment's photos, send them to GPT-4o with a vision prompt:

```
Describe what you see in these photos in vivid, specific detail.
Focus on: the setting, people present, objects, food, activities,
lighting, mood of the scene. Be specific — mention colors, brands,
locations if identifiable. 2-3 sentences per photo.
```

Collect all photo descriptions grouped by moment.

#### Step 3: Assemble the Generation Prompt

The system prompt sets up the persona. The user message provides the day's context.

**System Prompt Template:**

```
You are a personal journal writer. You write daily journal entries for a specific person
based on their captured moments throughout the day.

PERSONA — WRITING PREFERENCES:
- Writing style: {writing_style}
- Topics they care about: {journal_topics}
- Narrative voice: {narrative_voice} ("I" / "You" / "They")
- Emotional depth: {emotional_depth}
- Personality tags: {personality_tags}

PERSONA — LIFE CONTEXT:
- MBTI: {mbti or "not provided"}
- Occupation: {occupation or "not provided"}
- People in their day: {daily_people}
- Activities that fill their days: {daily_activities}
- Additional context from the user: "{additional_context or "none provided"}"

Use the MBTI type to shape the cognitive and emotional texture of the journal.
For example: an INTJ journals with analytical precision and internal processing.
An ESFP journals with sensory detail and in-the-moment energy.
An INFP journals with emotional depth and idealistic reflection.
If MBTI is not provided, rely on the other persona signals.

Use the life context (occupation, people, activities) to make the journal feel grounded
in the user's real life. Reference their world naturally — a student's journal mentions
classes and deadlines, a freelancer's mentions clients and creative blocks. Don't force
it; only reference what's relevant to the day's moments.

VOICE CALIBRATION (from recent journals):
{last_3_journal_excerpts_first_100_words_each}

RULES:
1. Write in the exact narrative voice specified (first/second/third person).
2. Match the writing style precisely. If "casual", use slang and short sentences.
   If "poetic", use imagery and rhythm. If "reflective", ask internal questions.
   If "witty", use humor and irony.
3. Reference SPECIFIC details from the photos — a color, a dish, a facial expression,
   a location. Never be vague.
4. Honor the emotional depth setting. "Light" = no deep introspection. "Deep" = explore
   feelings, doubts, gratitude, what things meant.
5. The journal should flow as a narrative of the day, not a list of events.
   Transitions between moments should feel natural.
6. Length: 200-500 words depending on number of moments.
7. Use markdown formatting subtly — no headers, but occasional *emphasis* or line breaks
   for pacing.
8. If the user provided text or voice context for a moment, weave their exact words and
   sentiments into the narrative naturally.
9. End with a closing reflection or feeling that ties the day together.
```

**User Message Template:**

```
Write today's journal entry based on these moments:

{for each moment, ordered by order_index:}
---
MOMENT {index + 1} — {formatted_time}
Mood: {mood or "not specified"}
Photos: {photo_descriptions from Step 2}
User's notes: {text_context and/or voice_transcript, or "none"}
---

Today's date: {formatted_date}
```

#### Step 4: Generate

Call OpenAI `chat.completions.create` with:
- model: `gpt-4o`
- messages: [system prompt, user message]
- temperature: `0.8` (creative but coherent)
- max_tokens: `1500`

#### Step 5: Store Result

Update the `journal_entries` row:
- `content` = generated text
- `status` = `draft`
- `generated_at` = now()

### Token Budget Estimation

- System prompt: ~400 tokens
- Per moment (2 photos + context): ~300 tokens
- 5 moments/day average: ~1500 tokens input
- Recent journals context: ~400 tokens
- Output: ~500-800 tokens
- **Total per generation: ~2500-3000 tokens** — well within GPT-4o limits, cheap per call.

### Photo Handling for the API

GPT-4o accepts images as base64 or URLs. Since photos are in Supabase Storage:
- Generate **signed URLs** (valid for 1 hour) for each photo.
- Pass URLs directly in the GPT-4o message content as `image_url` type content blocks.

```typescript
// Example: building the vision message for a moment's photos
const photoContents = photos.map(photo => ({
  type: "image_url" as const,
  image_url: { url: photo.signedUrl, detail: "low" } // "low" to save tokens
}));
```

---

## 10. Data Flow Diagrams

### Flow A: Moment Capture

```
User taps Capture/Library
        │
        ▼
 Photos selected/taken
        │
        ▼
 [Screen 4: Moment Creation]
  ├─ Optional: select mood
  ├─ Optional: type text context
  └─ Optional: record voice → POST /api/transcribe → Whisper → text
        │
        ▼
 User taps "Save Moment"
        │
        ▼
 Upload photos → Supabase Storage
        │
        ▼
 POST /api/moments
  ├─ Insert moments row
  └─ Insert moment_photos rows
        │
        ▼
 Return to Home, moment appears in today's row
```

### Flow B: Journal Generation

```
User taps "Start Journaling"
        │
        ▼
 [Screen 5: Timeline Confirmation]
  ├─ Moments displayed in order
  └─ User can drag to reorder
        │
        ▼
 User taps "Done — Generate"
        │
        ▼
 PATCH /api/moments/reorder (save final order)
        │
        ▼
 POST /api/journal/generate
        │
        ├─ Create journal_entries row (status: generating)
        │
        ├─ Fetch persona + moments + photos + recent journals
        │
        ├─ For each photo: GPT-4o vision → description
        │
        ├─ Assemble system prompt + user message
        │
        ├─ GPT-4o generate journal text
        │
        └─ Update journal_entries (content + status: draft)
              │
              ▼
 [Screen 6: Journal View]
  ├─ User reads generated journal
  ├─ Optional: edit content
  ├─ Optional: regenerate
  └─ Confirm & Save → status: confirmed
```

### Flow C: First-Time User

```
 User visits app
        │
        ▼
 /auth — Sign up / Log in
        │
        ▼
 Check: does persona exist?
  ├─ No → /onboarding (Persona Survey, 11 steps)
  │         └─ POST /api/persona → /home
  └─ Yes → /home
```

---

## 11. Project File Structure

```
journie/                              # Monorepo root
├── client/                           # React + Vite frontend
│   ├── index.html                    # Vite entry HTML
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── .env                          # VITE_* env vars only
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── main.tsx                  # React entry point, router setup
│       ├── App.tsx                   # Root component, route definitions
│       ├── index.css                 # Tailwind directives + font imports
│       ├── pages/                    # One file per route/screen
│       │   ├── auth.tsx              # Login / Signup
│       │   ├── onboarding.tsx        # Persona survey stepped flow
│       │   ├── home.tsx              # Capture hub (camera + today's moments)
│       │   ├── moment-detail.tsx     # Add context + mood to a moment
│       │   ├── timeline.tsx          # Timeline confirmation + reorder
│       │   ├── journal-generate.tsx  # Generation loading + review + edit
│       │   ├── journal-view.tsx      # Read a single day's journal
│       │   └── journal-history.tsx   # Calendar + past entries list
│       ├── components/
│       │   ├── ui/
│       │   │   ├── button.tsx
│       │   │   ├── input.tsx
│       │   │   ├── textarea.tsx
│       │   │   ├── modal.tsx
│       │   │   ├── loading-spinner.tsx
│       │   │   └── progress-bar.tsx
│       │   ├── persona-survey.tsx    # Multi-step survey component
│       │   ├── camera-capture.tsx    # Camera/library input wrapper
│       │   ├── moment-card.tsx       # Thumbnail card for a moment
│       │   ├── moment-form.tsx       # Photo review + context + mood form
│       │   ├── voice-recorder.tsx    # Record button + transcription display
│       │   ├── mood-selector.tsx     # Horizontal emoji row
│       │   ├── timeline-list.tsx     # Reorderable timeline of moments
│       │   ├── journal-renderer.tsx  # Markdown rendering with inline photos
│       │   ├── journal-editor.tsx    # Editable markdown textarea
│       │   └── calendar-view.tsx     # Monthly calendar with journal dots
│       ├── lib/
│       │   ├── supabase.ts           # Supabase client init (auth only on client)
│       │   ├── api.ts                # Shared API client (wraps fetch, adds auth header)
│       │   ├── store.ts              # Zustand store (today's moments, auth state)
│       │   └── utils.ts              # Date formatting, image compression, helpers
│       └── types/
│           └── index.ts              # Re-exports from shared/types.ts
│
├── server/                           # NestJS backend
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── .env                          # Server-only secrets (OpenAI key, Supabase service key)
│   └── src/
│       ├── main.ts                   # NestJS bootstrap, CORS config, global pipes
│       ├── app.module.ts             # Root module, imports all feature modules
│       ├── common/
│       │   ├── guards/
│       │   │   └── auth.guard.ts     # Validates Supabase JWT, attaches user to request
│       │   ├── decorators/
│       │   │   └── current-user.ts   # @CurrentUser() param decorator
│       │   └── supabase/
│       │       └── supabase.service.ts  # Supabase client (service role, server-side)
│       ├── persona/
│       │   ├── persona.module.ts
│       │   ├── persona.controller.ts # POST /api/persona, GET /api/persona
│       │   ├── persona.service.ts    # Persona CRUD logic
│       │   └── dto/
│       │       └── create-persona.dto.ts
│       ├── moments/
│       │   ├── moments.module.ts
│       │   ├── moments.controller.ts # POST/GET/PATCH/DELETE /api/moments, PATCH /api/moments/reorder
│       │   ├── moments.service.ts    # Moment CRUD + photo upload logic
│       │   └── dto/
│       │       ├── create-moment.dto.ts
│       │       ├── update-moment.dto.ts
│       │       └── reorder-moments.dto.ts
│       ├── transcribe/
│       │   ├── transcribe.module.ts
│       │   ├── transcribe.controller.ts  # POST /api/transcribe
│       │   └── transcribe.service.ts     # Whisper API call
│       ├── journal/
│       │   ├── journal.module.ts
│       │   ├── journal.controller.ts     # POST /api/journal/generate, GET/PATCH /api/journal/:date
│       │   ├── journal.service.ts        # Journal CRUD
│       │   └── generation/
│       │       ├── generation.service.ts # Full AI pipeline: vision + context assembly + text gen
│       │       ├── vision.service.ts     # GPT-4o photo description
│       │       └── prompts.ts            # All prompt templates (system + user)
│       ├── ai/
│       │   ├── ai.module.ts
│       │   └── openai.service.ts         # OpenAI client singleton
│       └── types/
│           └── index.ts                  # Re-exports from shared/types.ts
│
├── shared/                           # Shared types between client and server
│   └── types.ts                      # Canonical type definitions — both client and server import from here
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # Database schema (Section 5)
│
├── package.json                      # Root package.json (workspace scripts)
├── pnpm-workspace.yaml               # pnpm workspace config
├── .gitignore
└── README.md
```

### Root `package.json` Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"pnpm --filter client dev\" \"pnpm --filter server start:dev\"",
    "dev:client": "pnpm --filter client dev",
    "dev:server": "pnpm --filter server start:dev",
    "build:client": "pnpm --filter client build",
    "build:server": "pnpm --filter server build",
    "build": "pnpm build:client && pnpm build:server"
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
VITE_API_URL=http://localhost:3001/api
```

`VITE_` prefix = exposed to the browser via Vite. Only public keys go here.

### Server (`server/.env`)

```env
# Supabase (server-side, secret)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # Full DB access, never expose to client

# OpenAI
OPENAI_API_KEY=sk-...

# Server config
PORT=3001
CLIENT_URL=http://localhost:5173      # For CORS allowlist
```

All server env vars are secret. None are exposed to the browser.

---

## 13. MVP Scope — What to Build vs. Skip

### Build (hackathon MVP)

- [x] Supabase auth (email/password)
- [x] Persona survey (5 questions + free text + confirmation)
- [x] Home screen with camera capture + library import
- [x] Moment creation with photos + text context + mood
- [x] Voice recording → Whisper transcription
- [x] Timeline confirmation with drag-to-reorder
- [x] AI journal generation (full pipeline)
- [x] Journal view + edit + confirm
- [x] Journal history with calendar view

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
- **OpenAI failures** (timeout, rate limit, 500): Return a clear error to the client. Set journal status to `draft` with `content = "Generation failed — tap Regenerate to try again."` so the user isn't stuck on a `generating` spinner forever.
- **Supabase Storage failures:** Return 500 with `{ error: "Photo upload failed" }`. The client retries.
- **Rate limiting on `/api/journal/generate`:** Max 3 generation requests per user per day per date. Return 429 if exceeded. This prevents accidental OpenAI credit burn from spam-tapping "Regenerate".

### General
- Never silently swallow errors. Log all server-side errors with enough context to debug (user_id, endpoint, error message).
- All loading states must have a timeout — if an operation hasn't completed in 30 seconds, show "Something went wrong" with a retry option.

---

## 14. Design System — "Soft Journal"

> **This section is the visual source of truth.** All AI agents generating UI code must follow these specs exactly. Every component, color, radius, and font choice defined here is intentional and must be reproduced faithfully.

### 14.1 Design Philosophy

The vibe is **a physical journal that lives on your phone**. Not corporate-clean like Notion, not playful-loud like Duolingo. Think: a well-loved Moleskine notebook meets a calm meditation app. Warm, quiet, inviting.

**Core principles:**
- **Warm, not cold.** Every neutral is cream/beige-tinted, never blue-gray.
- **Soft, not sharp.** Large border-radius everywhere. No hard edges.
- **Personal, not clinical.** Serif font for journal content creates a "reading" experience distinct from the app UI.
- **Minimal, not empty.** Whitespace is generous but every element serves a purpose.
- **Light mode only for MVP.** Dark mode is a post-hackathon concern.

### 14.2 Color Palette

#### Warm Neutrals (backgrounds, cards, borders)

| Token              | Hex       | Tailwind Key    | Usage                                        |
| ------------------ | --------- | --------------- | -------------------------------------------- |
| Background         | `#FAF8F5` | `cream-50`      | Page background, app shell                   |
| Surface            | `#F5F0EB` | `cream-100`     | Card backgrounds, secondary surfaces         |
| Border             | `#E8E0D8` | `cream-200`     | Card borders, dividers, subtle separators     |
| Muted              | `#C4B8AC` | `cream-300`     | Disabled states, placeholder backgrounds      |

#### Text Colors

| Token              | Hex       | Tailwind Key    | Usage                                        |
| ------------------ | --------- | --------------- | -------------------------------------------- |
| Primary            | `#2C2825` | `ink-900`       | Headings, body text, primary labels           |
| Secondary          | `#5C554D` | `ink-700`       | Subtext, timestamps, secondary labels         |
| Tertiary           | `#8A8078` | `ink-500`       | Hints, placeholders, disabled text            |

#### Accent Colors (interactive elements)

| Token              | Hex       | Tailwind Key    | Usage                                        |
| ------------------ | --------- | --------------- | -------------------------------------------- |
| Accent Primary     | `#C8956C` | `accent-400`    | Primary buttons, active states, brand mark    |
| Accent Light       | `#D4A574` | `accent-300`    | Hover states, secondary highlights            |
| Accent Pale        | `#E8C9A8` | `accent-200`    | Accent borders, pill backgrounds, tags        |

#### Mood Colors (pastel, never saturated)

| Mood     | Emoji | Hex       | Tailwind Key    |
| -------- | ----- | --------- | --------------- |
| Great    | 🤩    | `#A8C5A0` | `mood-great`    |
| Good     | 😊    | `#D4B8D4` | `mood-good`     |
| Neutral  | 😐    | `#B4C8E0` | `mood-neutral`  |
| Low      | 😔    | `#E0D4B8` | `mood-low`      |
| Rough    | 😣    | `#E8B4B4` | `mood-rough`    |

### 14.3 Tailwind Configuration

```typescript
// tailwind.config.ts — extend the colors object with these:
{
  theme: {
    extend: {
      colors: {
        cream: {
          50:  '#FAF8F5',
          100: '#F5F0EB',
          200: '#E8E0D8',
          300: '#C4B8AC',
        },
        ink: {
          900: '#2C2825',
          700: '#5C554D',
          500: '#8A8078',
        },
        accent: {
          400: '#C8956C',
          300: '#D4A574',
          200: '#E8C9A8',
        },
        mood: {
          great:   '#A8C5A0',
          good:    '#D4B8D4',
          neutral: '#B4C8E0',
          low:     '#E0D4B8',
          rough:   '#E8B4B4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Merriweather', 'Georgia', 'serif'],
      },
      borderRadius: {
        'card': '14px',
        'button': '12px',
        'pill': '9999px',
      },
    },
  },
}
```

### 14.4 Typography

**Two-font system with strict separation:**

| Context                 | Font Family     | Tailwind Class   | Sizes Used                          |
| ----------------------- | --------------- | ---------------- | ----------------------------------- |
| All UI elements         | Inter (sans)    | `font-sans`      | 11px, 12px, 13px, 14px, 17px       |
| Journal content only    | Lora (serif)    | `font-serif`     | 15px body (line-height: 1.65), 14px closing reflection (italic) |

**Font loading:** Install via `@fontsource` packages and import in `client/src/index.css`:

```bash
pnpm --filter client add @fontsource/inter @fontsource/lora
```

```css
/* client/src/index.css */
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/lora/400.css';
@import '@fontsource/lora/400-italic.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Typography rules (agents must follow):**
- Navigation, buttons, labels, timestamps, mood labels → always `font-sans`.
- Generated journal text, journal previews, closing reflections → always `font-serif`.
- The user should subconsciously feel "I'm reading my journal" when they see serif text and "I'm using an app" when they see sans text. This split is non-negotiable.
- App name "journie" in the header: `font-sans`, 17px, font-weight 500, color `ink-900`.
- Section labels (e.g., "today's moments"): `font-sans`, 12px, font-weight 500, color `ink-500`, uppercase tracking optional.
- Timestamps: `font-sans`, 11px, color `ink-500`.
- Body text in journal: `font-serif`, 15px, line-height 1.65, color `ink-900`.
- Closing reflection in journal: `font-serif`, 15px, italic, color `ink-700`, centered.

### 14.5 Shape Language & Spacing

**Border radius:**
- Cards (moment cards, journal cards): `14px` (`rounded-card` or `rounded-[14px]`)
- Buttons (primary, secondary): `12px` (`rounded-button` or `rounded-xl`)
- Capture button: fully round `rounded-full` (96px circle)
- Small UI elements (photo thumbnails, icon buttons): `8px` (`rounded-lg`)
- Pills and tags: `9999px` (`rounded-pill` or `rounded-full`)
- **No sharp corners anywhere in the app.** Minimum radius is 8px.

**Spacing (agents must follow):**
- Page padding: `16px` on both sides (mobile).
- Gap between moment cards in feed: `8px`.
- Card internal padding: `10px` for compact cards (moment feed), `14px 16px` for content cards (journal).
- Section gap (e.g., between "today's moments" label and first card): `8px`.
- Gap between capture button and secondary actions: `20px`.
- Bottom CTA ("start journaling") margin-top: `16px`.

**Borders:**
- Cards: `1px solid cream-200` (`border border-cream-200`).
- Dividers: `1px solid cream-200` as `border-top` on section separators.
- No box shadows anywhere. Flatness is intentional — the warm background colors create enough depth without shadows.

### 14.6 Component Specifications

#### Capture Button (Home Screen Center)

```
- Container: 96×96px circle
- Background: accent-400 (#C8956C)
- Icon: camera icon, 36px, stroke white (#FAF8F5), stroke-width 1.8
- Below: "tap to capture a moment", font-sans 12px, ink-500
- Active state: scale(0.95) transform, accent-300 background
```

#### Moment Card (Home Feed)

```
- Container: full-width, bg white (#FFFFFF), border 1px cream-200, rounded-[14px], padding 10px
- Layout: horizontal flex, gap 10px, align-items center
- Left: photo thumbnail, 44×44px, rounded-lg (8px), object-cover
  - If no photo loaded yet: solid fill using the mood color as placeholder
- Right column:
  - Top row: flex justify-between
    - Left: moment title/context snippet, font-sans 12px bold, ink-900, single-line truncate
    - Right: mood emoji, 16px
  - Bottom row: timestamp + photo count, font-sans 11px, ink-500
    - Format: "9:12 AM · 2 photos"
```

#### Primary Button ("start journaling")

```
- Full width
- Background: accent-400 (#C8956C)
- Text: white (#FAF8F5), font-sans 14px, font-weight 500, centered
- Padding: 12px vertical
- Border-radius: 14px
- Active state: accent-300 background, scale(0.98)
- Disabled state: cream-300 background, ink-500 text
```

#### Secondary Button (e.g., "redo", "skip")

```
- Background: cream-100 (#F5F0EB)
- Text: ink-700 (#5C554D), font-sans 13px, centered
- Padding: 11px 14px
- Border-radius: 12px
- No border
```

#### Pill Button (e.g., "my journal" in header)

```
- Background: transparent
- Border: 1px solid accent-200 (#E8C9A8)
- Text: accent-400 (#C8956C), font-sans 12px
- Padding: 4px 10px
- Border-radius: 16px (pill)
```

#### Journal Content Card

```
- Container: full-width, bg white, border 1px cream-200, rounded-[14px], overflow hidden
- Photo section (top):
  - Full-width photo, object-cover
  - Height: 120px for first moment, 80px for subsequent
  - Timestamp overlay: font-sans 11px, ink-700, centered on photo
  - If no real photo: gradient fill using moment's mood color as base
    - great: linear-gradient(135deg, #A8C5A0, #88A880)
    - good: linear-gradient(135deg, #D4B8D4, #B498B4)
    - neutral: linear-gradient(135deg, #B4C8E0, #94AEC8)
    - low: linear-gradient(135deg, #E0D4B8, #C8BC98)
    - rough: linear-gradient(135deg, #E8B4B4, #D09494)
- Text section (bottom):
  - Padding: 14px 16px
  - Journal prose: font-serif 15px, line-height 1.65, ink-900
```

#### Closing Reflection (Bottom of Journal)

```
- No card wrapper — sits directly on page background
- Padding: 14px 0
- Text: font-serif 15px, italic, ink-700 (#5C554D), text-align center
- This is the last line of the generated journal — the AI's closing thought
```

#### Mood Selector (Moment Detail Screen)

```
- Horizontal row of 5 mood options, centered, gap 12px
- Each option:
  - 40×40px circle, bg cream-100, centered emoji 20px
  - Below: mood label, font-sans 11px, ink-500
- Selected state: bg of the mood's color (e.g., mood-great for "great"), slight scale(1.1)
- Unselected state: bg cream-100
```

#### Navigation Header

```
- Horizontal flex, justify-between, align-center
- Left: app name "journie", font-sans 17px, font-weight 500, ink-900
  - On sub-screens: back arrow (chevron-left icon, 20px, ink-500) instead of app name
- Center (sub-screens only): page title, font-sans 14px, font-weight 500, ink-900
- Right: contextual action (e.g., "my journal" pill, "edit" text link in accent-400)
- Height: implicit from content, margin-bottom 16–20px
```

#### Calendar View (Journal History)

```
- Month name + year header: font-sans 14px, font-weight 500, ink-900, centered
- Navigation arrows on either side of month name
- Day grid: 7 columns (Mon–Sun), each cell 36×36px
- Day numbers: font-sans 13px, ink-700
- Days with journals: circular colored dot (6px) below the number, using accent-400
- Today: text color accent-400, font-weight 500
- Tapping a day with a journal → navigate to /journal/[date]
```

### 14.7 Screen-Specific Layout Reference

#### Home Screen (`/home`)

```
┌─────────────────────────────────┐
│  journie              [my journal]│  ← nav header
│                                   │
│           ┌──────────┐            │
│           │  📷 96px  │            │  ← capture button, centered
│           └──────────┘            │
│      tap to capture a moment      │
│                                   │
│       [library]   [3 today]       │  ← secondary actions row
│                                   │
│  ─────────────────────────────── │  ← divider
│  today's moments                  │  ← section label
│  ┌────────────────────────────┐  │
│  │ 🖼 Morning coffee     😊   │  │  ← moment card
│  │     9:12 AM · 2 photos     │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ 🖼 Team standup       😐   │  │
│  │     11:30 AM · 1 photo     │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ 🖼 Lunch at the park  🤩   │  │
│  │     1:15 PM · 3 photos     │  │
│  └────────────────────────────┘  │
│                                   │
│  ┌────────────────────────────┐  │
│  │      start journaling      │  │  ← primary CTA
│  └────────────────────────────┘  │
└─────────────────────────────────┘
```

#### Generated Journal View (`/journal/[date]`)

```
┌─────────────────────────────────┐
│  ←    Saturday, March 22   edit  │  ← nav header
│                                   │
│         🤩  😐  😊               │  ← mood summary row
│                                   │
│  ┌────────────────────────────┐  │
│  │  ░░░░ photo ░░░░  9:12 AM │  │  ← journal card: photo top
│  │                             │  │
│  │  Started the morning the    │  │  ← journal card: serif prose
│  │  only way that makes sense  │  │
│  │  — with a cà phê sữa đá... │  │
│  └────────────────────────────┘  │
│                                   │
│  ┌────────────────────────────┐  │
│  │  ░░░ photo ░░░  11:30 AM  │  │
│  │                             │  │
│  │  Standup ran long again...  │  │
│  └────────────────────────────┘  │
│                                   │
│   Some days write themselves.     │  ← closing reflection (serif italic)
│     Today was one of those.       │
│                                   │
│  ┌──────────────────┐ ┌───────┐  │
│  │ looks great, save │ │ redo  │  │  ← action buttons
│  └──────────────────┘ └───────┘  │
└─────────────────────────────────┘
```

### 14.8 Icon Set

Use **Lucide React** (`lucide-react`) for all icons. Consistent 20px size, stroke-width 1.8, color `ink-500` for inactive, `ink-900` for active/header.

Key icons used:
- Camera: capture button
- Image: library import
- ChevronLeft: back navigation
- Mic: voice recording
- Calendar: journal history
- Sparkles: generation / AI actions
- Check: confirm / save
- RefreshCw: regenerate
- X: close / dismiss
- ChevronUp, ChevronDown: timeline reorder

### 14.9 Animation & Interaction (Minimal)

- **Button press:** `transform: scale(0.97)` on active, 100ms transition.
- **Card tap:** subtle `opacity: 0.85` on active, 80ms transition.
- **Page transitions:** none for MVP. Instant navigation.
- **Journal generation loading:** rotating sub-messages every 3 seconds ("Reading your photos...", "Capturing the mood...", "Writing your story..."), font-serif 15px italic, ink-500, centered, with a simple fade transition between messages.
- **No skeleton loaders, no shimmer effects, no complex animations.** Loading states use a simple centered spinner (accent-400 color) + text label.

### 14.10 Responsive Behavior

- **Primary viewport:** 375px width (iPhone SE / standard mobile).
- **Max content width:** 480px, centered with `mx-auto` on larger screens.
- **No tablet or desktop-specific layouts for MVP.** The app simply centers the mobile layout on wider screens with cream-50 background filling the rest.
- All touch targets: minimum 44×44px.

---

## 15. Hackathon Demo Strategy

Since the team will use the app throughout the hackathon as the demo itself:

1. **Day 0 (setup night):** Each team member completes persona survey with genuinely different styles (one casual, one poetic, one reflective). This showcases personalization during the demo.
2. **Day 1–2 (building):** Capture real moments — coding sessions, meals, whiteboard discussions, coffee runs. The more genuine the photos, the better the demo.
3. **Demo:** Show a real generated journal from the hackathon itself. Pull up the calendar, show 2–3 days of entries, read one aloud. The journal IS the pitch.

This is the strongest possible demo: a product that demonstrates itself through its own output.