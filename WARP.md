# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Quick start
- Prereqs: Node.js 18+, PostgreSQL.
- Install deps: `npm install`
- Env: copy `.env.template` to `.env` and set at minimum `DATABASE_URL` and one AI key.
- Initialize DB: `npm run db:push`
- Dev server: `npm run dev` (SvelteKit via Vite at http://localhost:5173)

## Common commands
- Dev/build
  - Start: `npm run dev`
  - Build: `npm run build`
  - Preview prod build: `npm run preview`
- Type checking
  - One-off: `npm run check`
  - Watch: `npm run check:watch`
- Database (Drizzle ORM / drizzle-kit)
  - Push schema to DB: `npm run db:push`
  - Run migrations: `npm run db:migrate`
  - Studio (GUI): `npm run db:studio`
- Unit tests (Vitest)
  - Watch: `npm run test`
  - Run once: `npm run test:run`
  - Coverage: `npm run test:coverage`
  - Single spec: `npm run test -- src/lib/utils/formatting.test.ts`
  - Single test name: `npm run test -- -t "renders chat header"`
  - UI runner: `npm run test:ui`
- E2E tests (Playwright)
  - All: `npm run test:e2e`
  - Single spec: `npm run test:e2e -- tests/e2e/03-chat-interface.spec.ts`
  - Headed: `npm run test:e2e:headed`
  - UI mode: `npm run test:e2e:ui`
  - Show last report: `npm run test:e2e:report`
- Internationalization (Paraglide)
  - Machine translate messages: `npm run machine-translate`
- Utilities
  - Promote a user to admin (simple): `npm run set-admin`

## Architecture overview
High-level structure and flow:

- Frontend (SvelteKit + Svelte 5 Runes)
  - Routes and pages in `src/routes/**` using SvelteKit conventions (`+page.svelte`, `+page.server.ts`, `+layout.svelte`).
  - UI components under `src/lib/components/**` (includes a comprehensive `ui/` kit) and app-specific pieces like `ChatInterface.svelte`, `ChatSidebar.svelte`, `FileUpload.svelte`.
  - Styling via TailwindCSS 4; Vite plugins configured in `vite.config.ts` (SvelteKit, Tailwind, devtools JSON, Paraglide i18n).
  - Internationalization powered by Paraglide; project config in `project.inlang/`, generated runtime in `src/paraglide/`.

- Server/API (SvelteKit endpoints)
  - REST-like endpoints in `src/routes/api/**/+server.ts` for chats, images, videos, models, billing (Stripe), admin, integrations, and memory features.
  - Endpoints call service modules in `src/lib/server/**` for business logic (auth, security, storage, email, usage tracking, pricing plans, integrations).

- Authentication & security
  - Auth.js (SvelteKit) configured in `src/auth.ts` and `src/lib/server/auth-config.ts` with Drizzle adapter.
  - Security modules: `security-headers.ts`, `session-security.ts`, `rate-limiting.ts`, `turnstile.ts`, `security-monitoring.ts`.
  - Input sanitization and standardized error handling in `src/lib/utils/sanitization.ts` and `src/lib/utils/error-handling.ts`.

- Data & storage
  - PostgreSQL with Drizzle ORM; schema in `src/lib/server/db/schema.ts`, DB access via `src/lib/server/db/index.ts`.
  - Drizzle config: `drizzle.config.ts` (reads `DATABASE_URL`). Use `db:studio` to inspect.
  - Media storage abstraction in `src/lib/server/storage.ts` (Cloudflare R2 and local fallback; optional AWS-compatible S3).

- AI providers and tools
  - Provider abstraction under `src/lib/ai/providers/*` for OpenRouter, Google Gemini, OpenAI, xAI, Stability, BFL, Kling, Luma, Alibaba.
  - Central routing and types in `src/lib/ai/model-router.ts`, `src/lib/ai/types.ts`, and `src/lib/ai/index.ts`.
  - Function-calling tools in `src/lib/ai/tools/*` (e.g., deep-research, think-longer) with execution endpoint at `src/routes/api/tools/execute/+server.ts`.

- Admin & settings
  - Admin dashboard under `src/routes/admin/**` for users, analytics, subscriptions, and system settings (AI models, OAuth, storage, security, mailing).
  - Settings persistence via `src/lib/server/admin-settings.ts` and `src/lib/server/settings-store.ts`.

- Testing
  - Unit/integration tests with Vitest (`vitest.config.ts`), using `happy-dom` and coverage over TS/Svelte.
  - E2E tests with Playwright (`playwright.config.ts`), which auto-starts the dev server; specs live in `tests/e2e/**`.

## Notes pulled from README
- Requires Node 18+ and a PostgreSQL database.
- Configure env via `.env.template` (e.g., DB, at least one AI key); see README for provider options.
- Project uses Svelte 5 Runes, strict TypeScript, Tailwind 4, and Drizzle ORM.
- Billing (Stripe), media storage (R2/local), and various integrations are implemented; some advanced streaming UI work is in progress.
