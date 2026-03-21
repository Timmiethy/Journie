# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Journie is a photo-first daily journaling app. Users capture moments (photos + text/voice/mood) throughout the day, then an AI pipeline generates a personal journal entry reflecting their voice. The system learns the user's writing style over time through edit diffs and memory accumulation.

## Commands

```bash
# Development (from project root)
pnpm install                    # Install all workspace deps
pnpm dev                        # Start client + server concurrently (scripts/dev.mjs)
pnpm dev:client                 # Client only (Vite on :5173)
pnpm dev:server                 # Server only (NestJS on :3001)

# Build
pnpm build                      # Build client + server
pnpm build:client               # Vite production build
pnpm build:server               # NestJS build

# Testing
pnpm test:e2e                   # All Playwright E2E tests
pnpm test:smoke                 # Smoke tests only
pnpm --filter client test       # Vitest unit tests
pnpm --filter client test:watch # Vitest watch mode

# Lint
pnpm --filter client lint       # ESLint (client only)
```

## Architecture

### Monorepo Structure (pnpm workspaces)

- **`client/`** — React 18 + Vite + Tailwind + Zustand + Framer Motion
- **`server/`** — NestJS 10 + Supabase (Postgres + Storage) + OpenAI/Qwen APIs
- **`shared/`** — Canonical TypeScript types (`shared/types.ts`) used by both sides
- **`supabase/migrations/`** — Versioned SQL migrations (001_, 002_, ...)
- **`docs.md`** — Detailed architecture reference (single source of truth)

### Client

- Entry: `client/src/App.tsx` — BrowserRouter with lazy-loaded routes
- API calls go through `client/src/lib/api.ts` (centralized client with auth headers, 30s timeout, 401 redirect) — never use raw fetch
- Auth via Supabase client SDK (anon key), stored in `lib/supabase.ts`
- Global state in Zustand store (`lib/store.ts`): userId, todayMoments, currentAura
- Mobile-first: max-width 480px via AuraShell wrapper
- Vite proxies `/api` → `http://127.0.0.1:3001`

### Server

- NestJS modules: **CommonModule** (global: Supabase, AuthGuard, Health), **PersonaModule**, **MomentsModule**, **TranscribeModule**, **JournalModule**, **AiModule**
- Auth: `AuthGuard` validates Supabase JWT from `Authorization: Bearer` header → `@CurrentUser()` decorator
- All endpoints prefixed with `/api`
- Controllers handle HTTP only; business logic lives in services
- DTOs validated with class-validator (whitelist + transform enabled globally)

### AI Generation Pipeline (JournalModule)

The core differentiator. Async tri-step pipeline triggered by `POST /api/journal/generate`:

1. **Tags** (Qwen Flash) — Vision-based extraction of activity/location/mood/food tags from photos
2. **Writer** (Qwen Plus) — Generates journal body using persona + memories + recent journals + edit history
3. **Memory** (distilled) — Extracts user preferences/relationships/routines into `user_memories` table

Returns `202 Accepted` immediately; client polls `GET /api/journal/:date` for status.

### Voice Profile Learning

- After journal confirmation, `VoiceProfileService` analyzes diffs between AI-generated and user-edited content
- Extracts preferred/avoided phrases, voice summary
- Stored in `user_memories` with category `voice`
- Refreshes every 5 confirmed journals

## Environment Variables

### Client (`client/.env`)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project
- `VITE_API_URL` — leave empty to use Vite proxy

### Server (`server/.env`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server-side Supabase (service role)
- `OPENAI_API_KEY`, `OPENAI_BASE_URL` — AI provider (currently DashScope/Qwen endpoint)
- `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_DISTILLATION_MODEL`, `OPENAI_TRANSCRIPTION_MODEL`
- `PORT` (3001), `CLIENT_URL` (http://localhost:5173)

## Database

PostgreSQL via Supabase with Row-Level Security on all tables. Key tables:

- **personas** — one per user (writing style, MBTI, occupation, voice preferences)
- **moments** / **moment_photos** — daily captures with photos in Supabase Storage
- **journal_entries** — status: generating → draft → confirmed; unique per user+date
- **moment_tags** / **daily_tag_summaries** — AI-extracted tags with confidence
- **user_memories** — learned facts (preference/relationship/routine/identity/voice)
- **voice_profiles** — distilled writing voice per user

Migrations in `supabase/migrations/` — apply via Supabase CLI or SQL editor.

## Conventions

- **Files/folders:** `kebab-case`; **React components:** `PascalCase`; **DB:** `snake_case`
- TypeScript strict mode in both client and server
- Client components should stay under ~150 lines
- Supabase SDK on client is for **auth only** — all data goes through server API
- Framer Motion for animations; respect `prefers-reduced-motion`
