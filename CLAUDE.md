# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

Yarn 4 monorepo for a multi-currency personal/shared finance app. V1 is web-only — `apps/mobile` is a placeholder for post-V1.

```
packages/
  common/   shared contracts (Zod schemas, DTOs, enums) — consumed as raw TS sources
  api/      NestJS 10 + TypeORM 0.3 + Postgres 16
  web/      Next.js 15 (App Router) + Tailwind v4 + shadcn/ui
apps/
  mobile/   Expo (post-V1, scaffold only)
```

## Common commands

Run from the repo root unless noted.

| Command | Notes |
|---|---|
| `yarn dev` | Web (3000) + API (3333) in parallel |
| `yarn build` | Topological build of all workspaces |
| `yarn lint` / `yarn lint:fix` | ESLint across packages |
| `yarn typecheck` | `tsc --noEmit` across packages |
| `yarn test` | All workspaces (Jest in api, Vitest in web/common) |
| `yarn format` | Prettier |

Per-workspace work uses `yarn workspace @finance/<name> <script>`. Examples:

- `yarn workspace @finance/api migration:run` — apply migrations
- `yarn workspace @finance/api migration:generate src/infra/database/migrations/<Name>` — generate from entity diff
- `yarn workspace @finance/api seed` — seed currencies
- `yarn workspace @finance/api test --testPathPattern wallet` — run a single test file in api
- `yarn workspace @finance/web test src/lib/forms/foo.test.ts` — single Vitest file
- `yarn workspace @finance/api dev` — API alone (uses ts-node loader; no build step)

DB up/down: `docker compose up -d db` / `docker compose down`. Connection defaults to `postgresql://finance:finance@localhost:5432/finance_dev`.

## Architecture — what spans multiple files

### Common package as live TS sources
`@finance/common` exports raw `./src/**/index.ts` via `main`/`types`/`exports` — there is no compiled `dist` consumed at runtime. Both `api` (ts-node) and `web` (Next compiler) pick up source changes immediately. Shared module subpaths (`@finance/common/wallet`, `@finance/common/auth`, etc.) are declared in `packages/common/package.json#exports` and must be added there when introducing a new module. Zod schemas + their inferred input/output types live here and are the single source of truth for request/response shapes on both sides.

### API request lifecycle
`packages/api/src/main.ts` mounts everything under `/api/v1`, with helmet, cookie-parser, CORS keyed off `ALLOWED_ORIGINS`, and Swagger gated by `ENABLE_SWAGGER`. `app.module.ts` wires:
- `TypeOrmModule.forRootAsync` with `synchronize: false` (always use migrations)
- `ThrottlerModule` with two buckets: `default` and a stricter `auth` bucket (limits differ in prod vs dev)
- `I18nModule` (nestjs-i18n) with `pt-BR` fallback, resolving via `?lang=`, `x-lang` header, and `Accept-Language`
- Global `APP_FILTER` (`AllExceptionsFilter`), `APP_INTERCEPTOR` (`LoggingInterceptor`), `APP_GUARD` (`ThrottlerGuard`)

Feature modules under `src/modules/<feature>/` follow the standard NestJS triplet (`*.controller.ts`, `*.service.ts`, `*.module.ts`) plus `*.entity.ts` files registered in `app.module.ts`'s `entities` array.

### Auth & group scoping
- `JwtAuthGuard` validates the access token (Passport JWT strategy in `modules/auth/strategies/`).
- `GroupScopeGuard` (in `common/guards/`) reads `:groupId` from `req.params` (or `req.body.groupId`), looks up the caller's `GroupMember`, attaches it to `req.groupMember`, and enforces `@AllowedRoles(...)` from `common/decorators/allowed-roles.decorator.ts`. Use both guards together on any group-scoped controller — see `wallet.controller.ts` for the canonical pattern (`@UseGuards(JwtAuthGuard, GroupScopeGuard)` + `@AllowedRoles(...)` per handler).
- Refresh tokens are rotated and persisted (`AuthRefreshToken` entity); the client never holds them as JS — they live in an httpOnly cookie scoped to `/api/proxy/auth`.

### Validation: Zod, not class-validator
Use `ZodValidationPipe` from `common/pipes/zod-validation.pipe.ts` directly on the `@Body()` parameter: `@Body(new ZodValidationPipe(createWalletSchema)) body: CreateWalletInput`. **Do not** apply it via `@UsePipes` at the handler/class level — it would run against every parameter (including `@CurrentUser()` etc.) and produce spurious `VALIDATION_FAILED` errors. The pipe maps `ZodError` to `BadRequestException` with `code: ErrorCode.VALIDATION_FAILED` and a flat `fieldErrors` map.

### Web: BFF proxy + server-side fetch
The browser never talks to the NestJS API directly. Two server-side paths exist:

1. **Client components → `/api/proxy/[...path]`** (`packages/web/src/app/api/proxy/[...path]/route.ts`). This route handler injects the `Authorization: Bearer` from the httpOnly access cookie (`fin_at`), intercepts `/auth/login|register|refresh` to persist tokens and strip the access token from the body before forwarding to the browser, intercepts `/auth/logout` to clear cookies, and transparently retries once on 401 by calling `/auth/refresh`.
2. **Server components / route handlers / server actions → `apiServerFetch`** (`packages/web/src/lib/api/server.ts`). Same access-cookie injection plus active-group header (`X-Group-Id` from `ACTIVE_GROUP_COOKIE`), same one-shot 401→refresh→retry. The cookie store is read-only during render — refresh mutations are best-effort there and silently no-op (the next navigation will refresh again).

`API_INTERNAL_URL` (server-only env, never expose) is the upstream the proxy and server fetcher hit.

### Web: routing, auth gate, i18n
- App Router uses route groups: `(public)/` for guest-only pages (`/login`, `/signup`, `/forgot-password`, `/reset-password`) and `(app)/` for the authenticated shell. `/invites` is in `(public)` but tolerates either state.
- `middleware.ts` is the auth gate: redirects unauthenticated users to `/login?next=...`, redirects authenticated users away from auth-only pages, lets public prefixes through. The matcher excludes `/api/*`, `/_next/*`, and static assets.
- i18n uses `next-intl` **without URL prefix** — locale is resolved server-side via cookie/`Accept-Language` in `lib/i18n/request.ts`. Don't add `[locale]` segments.

### Database migrations
Two TypeORM DataSources exist: the runtime one in `app.module.ts`, and a CLI one in `infra/database/typeorm.config.ts` used by the `migration:*` and `seed` scripts (it loads `.env` from both the package and repo root). When adding an entity: register it in `app.module.ts`'s `entities` array, run `migration:generate`, review the SQL, then `migration:run`. Never set `synchronize: true`.

## Code conventions

- TS strict mode + `noUncheckedIndexedAccess` + `noUnusedLocals/Parameters` — handle the `T | undefined` cases.
- ESLint enforces `consistent-type-imports` and an alphabetized `import/order` with `newlines-between: 'always'` (groups: builtin → external → internal → parent → sibling → index → type). Run `yarn lint:fix` after refactors.
- `_`-prefixed names are exempt from the no-unused rule — use them only for genuinely required-but-unused params.
- Path aliases: web uses `@/*`; api uses package-relative imports (no `@/` alias).

## Yarn / setup notes

- `nodeLinker: node-modules` (Yarn 4 with classic linker, not PnP). Binaries (`.cmd` on Windows) work normally; no editor/typescript shim setup needed.
- Node `>=20.11`. Activate Yarn via `corepack prepare yarn@4.5.1 --activate`.
- No git hooks (Husky) and no CI are configured by design — don't add them unless asked.
