# Finance App

Monorepo for a multi-currency personal/shared finance organization app.

## Stack

- **Monorepo**: Yarn 4 Workspaces
- **API**: NestJS 10 + TypeORM 0.3 + PostgreSQL 16
- **Web**: Next.js 15 (App Router) + Tailwind v4 + shadcn/ui
- **Common**: Plain TypeScript — shared DTOs / Zod schemas
- **Mobile**: Expo (post-V1, scaffold only)

## Prerequisites

- Node.js >= 20.11 (use `.nvmrc`)
- Corepack enabled: `corepack enable`
- Docker (for local Postgres) — optional if you have a native Postgres

## Initial setup

```bash
# 1. Activate Yarn 4
corepack prepare yarn@4.5.1 --activate

# 2. Install deps
yarn install

# 3. Copy envs
cp .env.example .env
# edit .env with your values

# 4. Start Postgres (Docker option)
docker compose up -d db

# 5. Run migrations and seed
yarn workspace @finance/api migration:run
yarn workspace @finance/api seed

# 6. Start dev (web + api together)
yarn dev
```

## Scripts

| Command | What it does |
|---|---|
| `yarn dev` | Runs web (3000) + api (3333) in parallel |
| `yarn build` | Builds all packages in topological order |
| `yarn lint` / `yarn lint:fix` | ESLint across all packages |
| `yarn typecheck` | tsc --noEmit across all packages |
| `yarn test` | Tests across all packages |
| `yarn format` | Prettier across everything |

## Structure

```
packages/
  common/   shared contracts (DTOs, Zod schemas, enums)
  api/      NestJS + TypeORM + Postgres
  web/      Next.js + Tailwind
apps/
  mobile/   Expo (post-V1)
```
