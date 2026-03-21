# Journie - Gemini Project Context

## Project Overview
**Journie** is a mobile-first, photo-centric daily journaling application. It automates the journaling process by capturing "moments" (photos, voice notes, and text) throughout the day and using an AI pipeline to generate personalized journal entries that reflect the user's unique voice.

### Core Value Proposition
- **Photo-First:** The primary input is the camera.
- **AI-Powered Generation:** A tri-step pipeline (Tags, Writer, Memory) transforms raw moments into coherent narratives.
- **Voice Learning:** The system learns the user's writing style over time by analyzing edits made to AI-generated drafts.

## Tech Stack
- **Monorepo Manager:** `pnpm` with workspaces.
- **Frontend (`client/`):** React 18, Vite, Tailwind CSS, Zustand (state), Framer Motion (animations), React Router v6.
- **Backend (`server/`):** NestJS 10, Supabase (PostgreSQL, Auth, Storage).
- **AI Services:** OpenAI / Qwen (DashScope) for vision, transcription, and text generation.
- **Shared:** Canonical TypeScript types in `shared/types.ts`.

## Project Structure
- `client/`: React SPA. Main entry: `client/src/main.tsx`.
- `server/`: NestJS API. Main entry: `server/src/main.ts`.
- `shared/`: Shared TypeScript definitions.
- `supabase/`: Database migrations.
- `scripts/`: Development and orchestration scripts.
- `docs.md`: Comprehensive architecture and design document (Single Source of Truth).

## Key Commands
Run these from the root directory:
- `pnpm install`: Install all workspace dependencies.
- `pnpm dev`: Start both client (port 5173) and server (port 3001) concurrently.
- `pnpm build`: Build both client and server for production.
- `pnpm test:e2e`: Run Playwright end-to-end tests.
- `pnpm test:smoke`: Run quick smoke tests.
- `pnpm --filter client test`: Run Vitest unit tests for the frontend.

## Development Conventions
### General
- **Naming:** `kebab-case` for files/folders, `PascalCase` for components/classes, `snake_case` for database.
- **Strict Typing:** TypeScript strict mode is enabled; avoid `any`.

### Client
- **API Calls:** Use `client/src/lib/api.ts`. Never use raw `fetch`.
- **Auth:** Use Supabase SDK for session management; all other data via NestJS API.
- **Styling:** Tailwind CSS only. Mobile-first design (max-width 480px).
- **Components:** Keep under 150 lines; use `components/ui/` for primitives.

### Server
- **Architecture:** Standard NestJS Module/Controller/Service pattern.
- **Auth:** Use `AuthGuard` and `@CurrentUser()` decorator.
- **Validation:** `class-validator` for DTOs (whitelist/transform enabled).

## AI Pipeline (JournalModule)
The generation process is triggered by `POST /api/journal/generate`:
1. **Tags (Vision):** Extract activity/mood/location from photos.
2. **Writer (LLM):** Generate journal body using persona, moments, and history.
3. **Memory (Distillation):** Extract facts/preferences for future personalization.
4. **Voice Profile:** Analyze user edits to refine the writing style every 5 journals.

## Documentation Reference
For deep architectural details, refer to `docs.md` in the root directory.
