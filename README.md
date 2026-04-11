# Journie

A mobile-first journaling app that turns your daily moments into an AI-assisted journal draft.

Journie is a TypeScript monorepo with:
- **Client:** React + Vite SPA (`client/`)
- **Server:** NestJS REST API (`server/`)
- **Database/Auth:** Supabase (`supabase/` migrations)
- **Shared types:** `shared/types.ts`

For a detailed architecture walkthrough, see [`docs.md`](./docs.md).

---

## Features

- Email/password authentication with Supabase.
- Guided onboarding persona survey.
- Camera-first home flow with photo import/capture.
- Daily timeline management (reorder + delete moments).
- AI-assisted journal generation and editing.
- Journal archive view with calendar/history access.

---

## Monorepo Layout

```text
.
├── client/                 # React app
├── server/                 # NestJS API
├── shared/                 # Shared TypeScript types
├── supabase/migrations/    # SQL migrations
├── docs.md                 # Deep architecture notes
├── package.json            # Workspace scripts
└── pnpm-workspace.yaml     # Workspace package map
```

---

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- A Supabase project (URL + keys)

---

## Environment Variables

### Client (`client/.env`)

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
# Optional if your API is not reverse-proxied at /api in dev
VITE_API_URL=http://127.0.0.1:3001/api
```

### Server (`server/.env`)

```bash
PORT=3001
HOST=127.0.0.1
CLIENT_URL=http://localhost:5173

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# At least one AI provider should be configured for generation features
OPENAI_API_KEY=...
# Optional DashScope fallback/preferred provider
DASHSCOPE_API_KEY=...
QWEN_FLASH_MODEL=qwen2.5-vl-3b-instruct
QWEN_PLUS_MODEL=qwen-plus-latest
```

---

## Quick Start

From the repository root:

```bash
pnpm install
pnpm dev:server
pnpm dev:client
```

- Client runs on `http://localhost:5173`
- Server runs on `http://127.0.0.1:3001/api`

> You can also use `pnpm dev` (PowerShell helper script) if your environment supports it.

---

## Scripts

### Workspace (root)

```bash
pnpm dev            # Runs scripts/dev.ps1
pnpm dev:client     # Start Vite client
pnpm dev:server     # Start NestJS server
pnpm build          # Build client and server
pnpm test:e2e       # Run Playwright e2e suite (client package)
pnpm test:smoke     # Run smoke Playwright spec (client package)
```

### Client

```bash
pnpm --filter client dev
pnpm --filter client build
pnpm --filter client lint
pnpm --filter client test
pnpm --filter client test:e2e
```

### Server

```bash
pnpm --filter server start:dev
pnpm --filter server build
```

---

## Database Migrations

SQL migrations are in `supabase/migrations/` and represent the canonical schema changes for Journie.

Apply them through your preferred Supabase workflow/CLI for your target environment.

---

## Notes

- The client expects Supabase auth/session to be available before API access.
- Journal generation depends on AI provider configuration on the server.
- If `DASHSCOPE_API_KEY` is set, AI routing prefers DashScope for active generation tasks; otherwise it falls back to OpenAI.

---

## License

No license file is currently included in this repository.
