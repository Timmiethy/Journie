# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Journie is a mobile-first web app that generates personal daily journals from photos using AI. Users capture moments (photos + optional text/voice context), and GPT-4o writes a journal entry in their personal voice based on a one-time persona survey.

The canonical architecture document is `docs.md` at the repo root — if code conflicts with that doc, the doc wins.

## Commands

All commands run from the repo root unless noted. Package manager is **pnpm**.

```bash
# Development
pnpm dev                    # Run both client and server concurrently
pnpm dev:client             # Vite dev server (port 5173)
pnpm dev:server             # NestJS dev server with --watch (port 3001)

# Build
pnpm build                  # Build both client and server
pnpm build:client           # TypeScript check + Vite build
pnpm build:server           # NestJS build

# Client-specific (run from client/)
pnpm lint                   # ESLint
pnpm test                   # Vitest (unit tests, single run)
pnpm test:watch             # Vitest in watch mode
npx playwright test         # E2E tests (requires dev server running)
npx playwright test e2e/smoke.spec.ts  # Single E2E test file

# Server-specific (run from server/)
pnpm start:dev              # Dev server with file watching
pnpm start:debug            # Dev server with debugger
```

## Architecture

**Monorepo** with pnpm workspaces (`pnpm-workspace.yaml`): `client/` and `server/`.

### Shared Types

`shared/types.ts` is the single source of truth for TypeScript interfaces used by both client and server. Both sides re-export from `types/index.ts` in their respective `src/` directories.

- Client imports via `@/*` path alias (maps to `./src/*`)
- Server imports via `@shared/*` path alias (maps to `../shared/*`)

### Client (`client/`)

React 18 + Vite + Tailwind CSS + Framer Motion.

- **Routing:** React Router v6 — route components in `pages/`, protected routes redirect to `/auth`
- **State:** Zustand store (`lib/store.ts`) — holds userId, today's moments, online status, current aura color
- **API client:** `lib/api.ts` — typed fetch wrapper that auto-injects Supabase Bearer token, 30s timeout, auto-redirect on 401. All API calls go through this, never raw fetch in components.
- **Auth:** Supabase client SDK (`lib/supabase.ts`) handles login/signup/session. Server only validates tokens.
- **Styling:** Tailwind with custom theme (abyss/film/aura color scales in `tailwind.config.ts`). Uses shadcn/ui components (Radix UI primitives in `components/ui/`).
- **Animations:** Framer Motion with presets in `lib/motion.ts`
- **Vite proxy:** `/api` requests proxy to `http://127.0.0.1:3001` in dev

### Server (`server/`)

NestJS 10 with Express. No ORM — uses Supabase JS client directly.

- **Module structure:** Each feature has its own module/controller/service/DTOs following NestJS conventions
- **Auth:** `common/guards/auth.guard.ts` validates Supabase JWT via `supabase.auth.getUser(token)`. All controllers use `@UseGuards(AuthGuard)`.
- **`@CurrentUser()` decorator:** `common/decorators/current-user.ts` extracts authenticated user from request
- **Supabase:** `common/supabase/supabase.service.ts` — singleton client with service role key for server-side DB access
- **OpenAI:** `ai/openai.service.ts` — singleton client wrapper

**Key modules:**
- `persona/` — CRUD for user persona (writing style, MBTI, personality tags, etc.)
- `moments/` — Moment CRUD + photo upload to Supabase Storage + reorder
- `journal/` — Journal CRUD + generation orchestration
- `journal/generation/` — The core AI pipeline: `vision.service.ts` (photo descriptions via GPT-4o), `prompts.ts` (prompt templates), `generation.service.ts` (orchestrates everything)
- `transcribe/` — Voice-to-text via OpenAI Whisper

### AI Journal Generation Pipeline

Triggered by `POST /api/journal/generate`:

1. Fetch persona + today's moments (with photos) + last 3 confirmed journals
2. For each moment's photos → GPT-4o vision → textual descriptions
3. Assemble system prompt (persona + voice calibration from recent journals) + user message (moments timeline)
4. GPT-4o generates journal text (temperature 0.8, max 1500 tokens)
5. Store result in `journal_entries` with status `draft`

Rate limited to 3 generation attempts per user per date per 24 hours (in-memory).

## Environment Variables

**Client** (`client/.env`) — `VITE_` prefix, safe for browser:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` (optional, defaults to `/api` which Vite proxies)

**Server** (`server/.env`) — secrets, never exposed:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `PORT` (default 3001), `HOST`, `CLIENT_URL` (for CORS)

## Naming Conventions

- **Files/folders:** `kebab-case` (both client and server)
- **React components:** `PascalCase` class names, `kebab-case` filenames
- **NestJS classes:** `PascalCase` (e.g., `MomentsController`, `JournalService`)
- **Database tables/columns:** `snake_case`
- **API endpoints:** `/api/kebab-case`
- **Env vars:** `UPPER_SNAKE_CASE`

## Code Style

- TypeScript strict mode, no `any` types
- 2-space indentation, semicolons, single quotes
- Tailwind CSS only for styling (no CSS modules, no styled-components)
- Mobile-first responsive (375px base)
- Controllers handle HTTP only; business logic in services
- DTOs use `class-validator` + `class-transformer` for validation
