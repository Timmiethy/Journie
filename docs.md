# Journie — Current Monorepo Architecture

Last reconciled against the live codebase on 2026-03-22.

This document is descriptive, not normative. It is meant to reduce drift and hallucinations by summarizing what the repo actually does today. If a low-level detail here ever conflicts with the code in `client/`, `server/`, `shared/`, or `supabase/`, treat the code as the source of truth and update this file.

## 1. What Ships Today

Journie is a mobile-first journaling app with a React single-page frontend and a NestJS backend. The live user flow is:

1. The user signs up or logs in on `/auth`.
2. `/auth/resolver` checks the Supabase session and decides whether to send the user to `/onboarding` or `/home`.
3. `/onboarding` collects a 5-question persona profile.
4. `/home` is a live camera hero with a staged activity sheet for queued photos and saved moments.
5. The user reviews imported/captured photos in a full-screen modal, optionally adds mood/text/voice context, and saves a moment.
6. `/timeline` lets the user reorder or delete the current day's moments.
7. The user triggers journal generation and is navigated immediately to `/journal/:date` while the backend generates asynchronously.
8. `/journal/:date` polls until a draft exists, supports edit/regenerate/confirm, and can reopen confirmed entries from history.
9. `/journals` shows a month-based archive calendar plus a separate recent list.

The app is production-ready in the sense that the current client/server/test stack is coherent, the critical flows are implemented, and the repo contains passing build/lint/test/browser verification for the main frontend hardening work. It is still a focused product: the shipped frontend is centered on daily journals, not weekly summaries or social/sharing features.

## 2. Monorepo Layout

This is a `pnpm` workspace with two runtime apps plus shared types:

| Path | Role |
| --- | --- |
| `client/` | React 18 + Vite SPA |
| `server/` | NestJS REST API |
| `shared/types.ts` | Canonical shared TypeScript app types |
| `supabase/migrations/` | Database schema and feature migrations |
| `scripts/` | Local dev orchestration and Playwright runner helpers |

Workspace configuration is in `pnpm-workspace.yaml` and currently includes `client` and `server`.

## 3. Runtime Stack

### Frontend

- React 18
- React Router v6
- Framer Motion 12
- Tailwind CSS
- Zustand
- Supabase browser SDK for auth only
- Sonner for toasts
- `react-markdown` for journal rendering
- Bundled `@fontsource/inter` and `@fontsource/lora` fonts

### Backend

- NestJS 10
- Supabase JS client with the service role key
- `class-validator` / `class-transformer`
- OpenAI SDK

### AI Clients

The server uses two AI access layers:

- `OpenaiService` for direct OpenAI access, currently used by transcription and dormant helper services.
- `AiClientService` for the active tags/writer/memory pipeline.

`AiClientService` prefers DashScope if `DASHSCOPE_API_KEY` is present:

- `tags` uses `QWEN_FLASH_MODEL` or `qwen2.5-vl-3b-instruct`
- `writer` and `memory` use `QWEN_PLUS_MODEL` or `qwen-plus-latest`

If DashScope is not configured, those tasks fall back to OpenAI `gpt-4o`.

## 4. Frontend Architecture

### App Boot

`client/src/main.tsx` wraps the app with:

- `LazyMotion`
- `MotionConfig reducedMotion="user"`

This means reduced-motion preferences are respected across the motion layer.

### Router

`client/src/App.tsx` lazy-loads all route pages and defines this live route tree:

| Route | Behavior |
| --- | --- |
| `/auth` | Email/password signup/login screen |
| `/auth/resolver` | Session + persona resolver with retry state |
| `/onboarding` | Protected 5-step persona survey |
| `/home` | Protected camera-first home route |
| `/moments/new` | Protected compatibility route that only works when live files are passed in route state |
| `/timeline` | Protected daily timeline reorder/delete screen |
| `/journal/:date` | Protected journal reader/editor/generator state |
| `/journals` | Protected archive route |
| `*` | Redirects to `/home`, which then falls through auth protection if the user is anonymous |

`ProtectedRoute` restores the Supabase session with retry logic before deciding whether to render the child route or redirect to `/auth`.

### Global UI and State

`client/src/components/layout/AuraShell.tsx` is the main visual shell:

- full-screen abyss background
- aura gradients driven by the last saved moment mood
- single centered mobile column with `max-width: 480px`

`client/src/lib/store.ts` is the main global store. It currently holds:

- `userId`
- `displayName`
- `isOnline`
- `todayMomentsDate`
- `todayMoments`
- `currentAura`
- global calendar popover state

Important detail: `todayMoments` is date-aware now. The store will only reuse cached moments if the requested date matches `todayMomentsDate`, which prevents stale moment lists from leaking across midnight.

### Shared Client Infrastructure

#### API client

`client/src/lib/api.ts` is the only supported HTTP layer in the frontend. It:

- pulls the access token from Supabase through `getSessionWithRetry()`
- applies a 30 second timeout to requests
- supports JSON and multipart requests
- handles `204 No Content`
- signs the user out and redirects to `/auth` on `401`

#### Auth/session helpers

`client/src/lib/auth-session.ts` retries session lookup up to 20 times with a 150ms delay between attempts.

#### Route preloading

`client/src/lib/route-preloaders.ts` exposes small preload helpers for:

- onboarding
- timeline
- journal history
- journal view

These are used by hover/focus/navigation paths to reduce route latency.

#### Offline behavior

`client/src/App.tsx` listens to `online` and `offline` events and displays a fixed top banner when the browser is offline. Destructive or network-backed actions across the app check `isOnline` before firing.

## 5. Current Frontend Routes And UX Contracts

### `/auth`

`client/src/pages/auth.tsx` is a single-screen auth form with a mode toggle:

- default mode is `signup`
- toggle switches between `signup` and `login`
- successful auth writes the user to Zustand immediately
- navigation then goes to `/auth/resolver`

The frontend does not use OAuth flows today. It is email/password only.

### `/auth/resolver`

`client/src/pages/post-auth-resolver.tsx`:

- calls `getSessionWithRetry()`
- if no session exists, redirects to `/auth`
- if a session exists, hydrates the user store
- requests `GET /api/persona`
- routes to `/home` if the persona exists or `/onboarding` if it does not

This route no longer dumps authenticated users back to `/auth` on transient persona errors. It now shows a retryable failure state with `try again` and `back to auth` actions.

### `/onboarding`

`client/src/pages/onboarding.tsx` is a 5-step editorial survey, not the older boxed wizard documented in previous versions of this repo.

The live steps are:

1. `attention_filter`
2. `life_chapter`
3. `tone_preset`
4. `daily_people`
5. `additional_context`

Current UX details:

- full-bleed editorial layout inside `AuraShell`
- step label only; no pagination dots
- animated step panel swaps with reduced-motion fallback
- inline preview sentence on the final step
- final CTA label is `enter journie`

Submit behavior:

- `POST /api/persona`
- on success: `navigate('/home', { replace: true })`

### `/home`

`client/src/pages/home.tsx` is camera-first and built around a staged bottom sheet. It is not a two-page scroll-snap layout anymore.

The live pieces are:

- `CameraCapture`
- `HomeActivitySheet`
- `MomentForm` modal overlay
- read-only saved moment detail modal

#### Camera area

`client/src/components/camera-capture.tsx` provides:

- square live camera preview when `getUserMedia` succeeds
- fallback state when the camera is denied, unsupported, or errors
- shutter button
- library import button
- archive/journal button
- queue badge when unsaved captures exist

Camera captures are cropped to square and saved as JPEGs before they enter the local queue.

#### Activity sheet

`client/src/components/home-activity-sheet.tsx` has 3 visual states:

- `collapsed`
- `peek`
- `full`

The sheet can be tapped or dragged between those states. The hero stage above it responds to live sheet progress, so the home route is currently built around a motion-linked hero/sheet composition rather than route transitions.

Current behaviors:

- `peek` shows today's saved moments and the primary dock CTA
- `full` shows queued captures, a clear/remove flow, and a grid of today's moments
- empty state is still reachable; the sheet is not auto-disabled when there is no content

#### Moment creation

The active moment creation path is a modal overlay on `/home`, using `MomentForm`.

`client/src/components/moment-form.tsx` is a 2-step form:

1. `review`
2. `context`

It supports:

- reviewing/removing photos
- adding more files
- optional mood
- optional typed context
- optional voice recording via `MediaRecorder`
- voice transcription through `POST /api/transcribe`
- client-side image compression before upload

Saving builds a multipart form and sends `POST /api/moments`.

On success:

- the result is added to the date-aware Zustand store
- the queue is cleared
- the app stays on `/home`
- the timeline route is preloaded

#### `/moments/new`

`client/src/pages/moment-detail.tsx` still exists, but it is now a compatibility route, not the main moment workflow.

It only works if live `File[]` objects are present in route state. If the user refreshes or enters directly without those files, it shows a loading handoff and redirects back to `/home`.

### `/timeline`

`client/src/pages/timeline.tsx` is the daily sequencing screen.

Current behavior:

- loads today's moments from the store first
- falls back to `GET /api/moments?date=...`
- supports local reorder and delete
- shows an empty-state card if there are no moments

Generation behavior:

- stores the current ordered moments back in Zustand
- fires `PATCH /api/moments/reorder` in the background
- calls `POST /api/journal/generate` with `date`, `regenerate=false`, and ordered `momentIds`
- navigates immediately to `/journal/:date`
- passes typed route state with `optimisticGenerating: true` and `source: 'timeline'`

### `/journal/:date`

`client/src/pages/journal-view.tsx` is a combined loader, poller, reader, editor, and action surface.

Current behaviors:

- loads the journal row and the day's moments in parallel
- if navigated optimistically from `/timeline`, tolerates an initial `404` and creates a temporary `generating` client-side journal model
- polls `GET /api/journal/:date` every 2 seconds
- times out after 90 seconds
- tolerates transient poll errors before failing
- protects the last stable draft from being overwritten by empty terminal payloads
- treats `Generation failed — tap Regenerate to try again.` as an explicit retry state

Current actions:

- edit
- regenerate
- confirm & save
- back home
- archive / back to timeline depending on route source and journal status

`JournalRenderer` strips backend-only structured tags such as:

- `<Insights>...</Insights>`
- `<daily_achievement>...</daily_achievement>`
- `<best_photo>...</best_photo>`

The renderer also:

- shows a cursor-style generating state
- supports highlighted photo + inline photo opens
- passes photo clicks into a lightbox

### `/journals`

`client/src/pages/journal-history.tsx` is the archive route.

Current behavior:

- shows a month header with previous/next month controls
- uses `CalendarView` for the visible month grid
- fetches month data through `GET /api/journals` with `status=confirmed`, `from`, and `to`
- primes the current month plus the previous two months on load
- fetches `recent` entries separately with `status=confirmed&limit=8`

That last point matters: recent entries are no longer inferred from the month cache, so older confirmed journals can appear immediately even if the current month is empty.

`CalendarDayPopover` is mounted globally in `App.tsx`, with open state stored in Zustand. It:

- anchors to the clicked calendar day
- previews the first line of the journal
- shows the first photo thumbnail when available
- supports keyboard dismissal and focus management
- opens `/journal/:date` with route source `history`

## 6. Backend Architecture

### App composition

`server/src/app.module.ts` imports:

- `ConfigModule`
- `CommonModule`
- `PersonaModule`
- `MomentsModule`
- `TranscribeModule`
- `JournalModule`
- `AiModule`

### Server boot

`server/src/main.ts`:

- creates the Nest app
- sets global prefix to `/api`
- enables `ValidationPipe({ whitelist: true, transform: true })`
- configures CORS
- defaults to `HOST=127.0.0.1` and `PORT=3001`

In non-production mode, CORS is intentionally permissive to support local tools such as tunnels.

### Auth model

The client owns session creation through Supabase auth. The server validates bearer tokens on every protected route via `AuthGuard`, which calls:

- `supabase.auth.getUser(token)`

The backend does not rely on a custom session store.

### Common services

`SupabaseService` exposes a single service-role Supabase client for server-side DB and storage access.

`CurrentUser` is a parameter decorator that pulls `request.user` from the guard-populated request object.

## 7. API Surface

All current routes are prefixed with `/api`.

### Health

- `GET /api/health`
  - returns `{ status: 'ok' }`
  - used by local orchestration and smoke checks

### Persona

- `POST /api/persona`
  - guarded
  - upserts the persona by `user_id`
  - validates:
    - `attention_filter`
    - `life_chapter`
    - `tone_preset`
    - `daily_people` (at least one item)
    - optional `additional_context`

- `GET /api/persona`
  - guarded
  - returns the current user's persona or `null`

### Moments

- `GET /api/moments?date=YYYY-MM-DD`
  - guarded
  - returns moments for the given date with sorted `moment_photos`

- `POST /api/moments`
  - guarded
  - multipart upload with:
    - `photos`
    - optional `text_context`
    - optional `voice_transcript`
    - optional `mood`
    - optional `captured_at`
    - optional `day_date`
  - validates image MIME types
  - rejects files larger than 10MB

- `DELETE /api/moments/:id`
  - guarded
  - deletes the moment row and corresponding storage objects

- `PATCH /api/moments/reorder`
  - guarded
  - body:
    - `date`
    - `order: string[]`
  - updates `order_index` sequentially

### Transcription

- `POST /api/transcribe`
  - guarded
  - multipart upload with `audio`
  - uses OpenAI Whisper when configured
  - falls back to a deterministic transcript string when OpenAI is unavailable or fails

### Journals

- `POST /api/journal/generate`
  - guarded
  - body:
    - `date`
    - optional `regenerate`
    - optional `momentIds`
  - returns `202 Accepted` and `{ journal_id, status: 'generating' }`

- `POST /api/journal/generate-weekly`
  - guarded
  - body:
    - `week_start`
  - backend-only capability today; no dedicated frontend flow currently calls it
  - important limitation: weekly summaries are still written through `journal_entries` keyed by `day_date=week_start`, while the unique index is still `(user_id, day_date)`, so weekly and daily entries cannot coexist safely on the same Monday

- `GET /api/journal/:date`
  - guarded
  - returns the journal row for that date
  - throws `404` if none exists

- `PATCH /api/journal/:date`
  - guarded
  - accepts:
    - optional `content`
    - optional `status` in `draft | confirmed`
  - preserves `generated_content` on first user edit when that column exists
  - sets or clears `confirmed_at` based on status

- `GET /api/journals`
  - guarded
  - supported query params:
    - `limit`
    - `offset`
    - `status`
    - `from`
    - `to`
    - `entry_type`
  - returns entries ordered by `day_date DESC`
  - enriches each row with `first_photo_url`

## 8. Journal Generation Pipeline

The active daily journal path lives in `server/src/journal/generation/generation.service.ts`.

### What it does

1. Enforces a per-user/per-date/per-day in-memory rate limit of 3 generation attempts.
2. Upserts a `journal_entries` row with `status='generating'` and `entry_type='daily'`.
3. Returns immediately to the client.
4. Continues the real work in `runGenerationPipeline(...)`.

### Context gathered for generation

The current live pipeline fetches:

- persona
- the day's moments
- recent confirmed journals
- long-term user memories
- recent edit diffs from confirmed journals with `generated_content`

If `momentIds` are provided, the pipeline reorders the fetched moments to match the client sequence.

### Photo handling

At generation time, the service re-signs each stored photo from `storage_path` for 1 hour. If signing fails but a stored `photo_url` exists, it falls back to that URL.

### AI stages

#### Tags

`TagsService` extracts per-moment tags and persists:

- `moment_tags`
- `daily_tag_summaries`

It uses `AiClientService('tags')` when available and falls back to simple deterministic tags when AI is unavailable.

#### Writer

The writer prompt is built from:

- persona
- memories
- recent confirmed journals
- recent edit diffs
- aggregated daily tags
- ordered moments with times, moods, notes, and signed photo URLs

The model receives multimodal input directly: text plus the signed image URLs.

Expected structured output:

- journal markdown body
- `<daily_achievement>`
- `<best_photo>`
- `<Insights>`

If the writer fails, generation falls back to a deterministic journal assembled from the persona and captured moments.

#### Persistence

On success, the pipeline:

- writes `content`
- writes `generated_content` when the column exists
- sets `status='draft'`
- stores `daily_achievement`
- stores `best_photo_url`
- persists `daily_insights`

On unrecoverable failure, it writes a draft row with:

- `content = 'Generation failed — tap Regenerate to try again.'`

#### Memory processing

After a successful generation, `MemoryService` runs in the background and can store durable facts in `user_memories`.

### Weekly generation

`WeeklyService` exists and is wired into the backend API. It:

- aggregates weekly tag summaries
- curates top tags
- loads confirmed daily journals and daily insights
- builds a weekly summary
- persists `weekly_summaries`
- also upserts a `journal_entries` row with `entry_type='weekly'`

Important limitation: there is no dedicated frontend route or button for weekly summary generation today.

### Dormant or partially wired services

These files exist but are not part of the current shipped daily client flow:

- `server/src/journal/generation/vision.service.ts`
- `server/src/journal/generation/voice-profile.service.ts`

The live daily generation path does not call either service. `vision.service.ts` is a standalone helper around image description, and `voice-profile.service.ts` manages `voice_profiles`, but that profile refresh loop is not currently wired into `JournalModule`'s active generation path.

This matters because older docs overstated a voice-profile learning loop as if it were part of the live runtime. It is not.

## 9. Shared Types And Database Schema

### Shared Type Source

`shared/types.ts` is the canonical shared model. It currently includes:

- `User`
- `Persona`
- `Moment`
- `MomentPhoto`
- `MomentTag`
- `DailyTagSummary`
- `DailyInsight`
- `UserMemory`
- `JournalEntry`
- `WeeklySummary`
- `MomentWithPhotos`
- `DayTimeline`

`server/src/types/index.ts` re-exports `shared/types.ts`.

### Database migrations

Current migrations:

- `001_initial_schema.sql`
- `002_tags_writer_memory.sql`
- `003_survey_rearchitecture.sql`

### Core tables currently represented in the repo

| Table | Purpose |
| --- | --- |
| `personas` | 5-field onboarding profile |
| `moments` | One captured moment row per save |
| `moment_photos` | Per-moment uploaded image metadata |
| `journal_entries` | Daily and weekly journal rows |
| `voice_profiles` | Legacy/dormant voice profile store still present in schema |
| `moment_tags` | AI-extracted per-moment tags |
| `daily_tag_summaries` | Aggregated top tags per day |
| `daily_insights` | Hidden writer insights and highlight data |
| `user_memories` | Active long-term memory store |
| `weekly_summaries` | Weekly summary data |

### Important schema truths

- `journal_entries` now includes:
  - `generated_content`
  - `entry_type`
  - `daily_achievement`
  - `best_photo_url`
- `personas` uses the current 5-question schema:
  - `attention_filter`
  - `life_chapter`
  - `tone_preset`
  - `daily_people`
  - `additional_context`
- `voice_profiles` still exists in the schema, but it is not the active memory system for the shipped daily generation path.
- `user_memories` is the active long-term memory table used by `MemoryService`.
- There is still one type/runtime mismatch worth knowing about: `shared/types.ts` models `JournalEntry.generated_at` as a string, but generating rows can still be `NULL` in the database until generation finishes.

### Storage

The active storage bucket is `moment-photos`.

Current server-side upload path:

`{user_id}/{day_date}/{moment_id}/{index}.jpg`

The server persists both:

- `storage_path`
- `photo_url`

`photo_url` is a long-lived signed URL created at upload time. The daily generation pipeline still prefers re-signing from `storage_path` for short-lived AI access.

Current caveat: generated `best_photo_url` values stored on `journal_entries` and `daily_insights` come from 1-hour signed URLs created during generation. The current read paths do not refresh those URLs later, so highlighted journal/archive images can expire.

## 10. Local Development And Runtime Scripts

### Root scripts

```json
{
  "dev": "pwsh -NoProfile -File scripts/dev.ps1",
  "dev:client": "pnpm --filter client dev",
  "dev:server": "pnpm --filter server start:dev",
  "build:client": "pnpm --filter client build",
  "build:server": "pnpm --filter server build",
  "build": "pnpm build:client && pnpm build:server",
  "test:e2e": "pnpm --filter client test:e2e",
  "test:smoke": "pnpm --filter client test:e2e:smoke"
}
```

### Client scripts

`client/package.json` currently provides:

- `dev`
- `build`
- `build:dev`
- `lint`
- `preview`
- `test`
- `test:watch`
- `test:e2e`
- `test:e2e:smoke`

### Server scripts

`server/package.json` currently provides:

- `build`
- `start`
- `start:dev`
- `start:debug`
- `start:prod`

The current production entrypoint is:

- `server/dist/server/src/main.js`

### Local dev orchestration

`scripts/dev.ps1`:

- kills listeners on `3001`, `5173`, `5174`, `5175`
- starts the backend watch server
- starts the client through `scripts/dev-client.ps1`

`scripts/dev-client.ps1`:

- waits until `http://127.0.0.1:3001/api/health` returns `200`
- then launches the local Vite binary from `client/node_modules/.bin/vite.cmd`

`scripts/dev-runner.mjs` is the Playwright helper:

- clears the usual local ports
- builds the backend
- starts `node dist/server/src/main.js`
- waits on `/api/health`
- then starts the client dev server

## 11. Environment Variables

### Client

Expected browser env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- optional `VITE_API_URL`

If `VITE_API_URL` is omitted, the client defaults to `/api`.

### Server

Actively used server env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HOST`
- `PORT`
- `CLIENT_URL`
- optional `OPENAI_API_KEY`
- optional `DASHSCOPE_API_KEY`
- optional `QWEN_FLASH_MODEL`
- optional `QWEN_PLUS_MODEL`

Behavioral notes:

- without `OPENAI_API_KEY`, transcription falls back deterministically
- without `DASHSCOPE_API_KEY`, the tags/writer/memory services fall back to OpenAI if it is configured
- without both AI providers, the journal/tag pipeline degrades to deterministic fallbacks instead of crashing

## 12. Testing And Quality Gates

### Linting

The client uses ESLint 9 flat config from `client/eslint.config.js`.

### Unit and component tests

The client uses Vitest plus Testing Library. The shared test harness lives under:

- `client/src/test/setup.ts`
- `client/src/test/test-utils.tsx`
- `client/src/test/render.tsx`
- `client/src/test/fixtures.ts`
- `client/src/test/store.ts`

The current test layer includes:

- API client tests
- store tests
- journal navigation tests
- route/page behavior tests
- overlay accessibility tests
- `jest-axe` route accessibility checks

### End-to-end tests

The current Playwright structure is:

- `client/e2e/mock/` for mock-backed flows
- `client/e2e/integration/` for integration wrappers
- `client/e2e/*.spec.ts` for the broader root regression specs

Current Playwright projects in `client/playwright.config.ts`:

- `mock-mobile-chromium`
- `mock-desktop-chromium`
- `mock-desktop-firefox`
- `integration-chromium`

Important nuance:

- `client/e2e/integration/` currently wraps only a subset of the root specs:
  - smoke
  - timeline reorder/generate flow
  - history range flow
- the broader root motion/regression specs still exist and can be run directly, but they are not all part of the `integration-chromium` project split

Artifacts now go to:

- `output/client-playwright`

The repo also ignores:

- `client/test-results/`
- `client/playwright-report/`

## 13. Non-Obvious Truths To Keep In Mind

These are the main places older docs or assumptions go wrong:

1. The home route is no longer a two-page scroll-snap composition. It is a camera hero plus a staged bottom sheet.
2. `/moments/new` still exists, but it is a compatibility path, not the primary capture flow.
3. The archive `recent` list is loaded independently from the month cache.
4. The daily generation pipeline is tags -> writer -> memory. It does not currently run the dormant voice-profile or standalone vision services.
5. Weekly generation exists in the backend but does not currently have a dedicated frontend feature path.
6. The frontend does not use direct database queries for app data. Supabase in the browser is used for auth; app data flows through the Nest API.
7. The journal view is intentionally optimistic and resilient: initial `404`s after generation can be part of the normal flow when the user arrives before the background pipeline has finished writing the row.
8. The weekly endpoint is not just unused in the frontend; it is also structurally unsafe today because weekly summaries and Monday daily journals still collide on the same unique `(user_id, day_date)` key.
9. Generation rate limiting is currently an in-memory per-process map. It resets on server restart and is not shared across multiple instances.
10. Some generated image URLs are intentionally short-lived. `best_photo_url` is currently stored as a signed URL that can expire, and the current read paths do not refresh it automatically.

## 14. Key Files

If you need to re-verify this document quickly, these are the highest-signal files:

- `client/src/App.tsx`
- `client/src/pages/auth.tsx`
- `client/src/pages/post-auth-resolver.tsx`
- `client/src/pages/onboarding.tsx`
- `client/src/pages/home.tsx`
- `client/src/components/home-activity-sheet.tsx`
- `client/src/components/moment-form.tsx`
- `client/src/pages/timeline.tsx`
- `client/src/pages/journal-view.tsx`
- `client/src/pages/journal-history.tsx`
- `client/src/lib/api.ts`
- `client/src/lib/store.ts`
- `server/src/main.ts`
- `server/src/app.module.ts`
- `server/src/moments/moments.service.ts`
- `server/src/transcribe/transcribe.service.ts`
- `server/src/journal/journal.controller.ts`
- `server/src/journal/journal.service.ts`
- `server/src/journal/generation/generation.service.ts`
- `server/src/journal/generation/tags.service.ts`
- `server/src/journal/generation/memory.service.ts`
- `server/src/journal/generation/weekly.service.ts`
- `server/src/ai/ai-client.service.ts`
- `shared/types.ts`
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_tags_writer_memory.sql`
- `supabase/migrations/003_survey_rearchitecture.sql`
