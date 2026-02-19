# NMH EMS Operations Dashboard

A full-stack web application for North Memorial Health's EMS division providing real-time operational metrics, quality improvement tools, scorecards, and a complete Field Training & Evaluation Program (FTEP) management system.

## Tech Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **Prisma 7** + SQLite (local) / Turso (production)
- **shadcn/ui** + Radix UI + Tailwind CSS 4
- **Recharts**, **@dnd-kit**, **jose**, **bcryptjs**, **Zod 4**
- **Vitest** for testing, **Husky** + **lint-staged** for git hooks

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and JWT_SECRET

# 3. Run database migrations
npx prisma migrate dev

# 4. Seed development data
node --import tsx prisma/seed.mjs

# 5. Start dev server
npm run dev
```

Open http://localhost:3000 — login with:

- **Email:** michael.morelock@northmemorial.com
- **Password:** Admin123!

All seed users use the password `Admin123!`.

## Three Portals

| Portal           | URL Prefix       | Roles                                    | Purpose                                   |
| ---------------- | ---------------- | ---------------------------------------- | ----------------------------------------- |
| Public Dashboard | `/`              | admin, manager, data_entry               | Operational metrics, scorecards, QI tools |
| Admin Portal     | `/admin`         | admin (+ limited manager/data_entry)     | Full CRUD management                      |
| Field Training   | `/fieldtraining` | fto, supervisor, trainee, admin, manager | DOR management, skill tracking            |

## Key Scripts

| Script               | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Start dev server (Turbopack)                              |
| `npm run build`      | Production build (prisma generate + migrate + next build) |
| `npm run test`       | Run test suite                                            |
| `npm run lint`       | ESLint check                                              |
| `npm run typecheck`  | TypeScript type check                                     |
| `npm run db:migrate` | Create new Prisma migration                               |
| `npm run db:seed`    | Run seed script                                           |
| `npm run db:reset`   | Reset database (destructive)                              |

## Project Structure

```
src/
  app/
    (public)/          # Dashboard routes (/, /scorecards, /metric/*, etc.)
    (admin)/           # Admin routes (/admin/*, /login, /register)
    (field-training)/  # Field training routes (/fieldtraining/*)
  actions/             # Server actions (15 domain files)
  components/          # React components (admin/, dashboard/, field-training/, ui/)
  lib/                 # Core utilities (auth, db, permissions, SPC, etc.)
  types/               # TypeScript type definitions
prisma/
  schema.prisma        # Database schema (well-commented)
  seed.mjs             # Development data seeder
  migrations/          # SQL migration files
```

## Developer Guide

A comprehensive technical reference is available in the running application at **Admin Portal > Developer Guide** (`/admin/developer-guide`). It covers:

- Architecture & routing (route groups, middleware, server/client split)
- Data model & the naming hierarchy (Department/Division/Region confusion)
- Authentication & security (JWT sessions, RBAC, CSRF, rate limiting)
- Coding patterns (server actions, audit logging, error handling)
- Known quirks & gotchas
- Deployment (local SQLite vs production Turso)
- Continuity notes for successor developers

The guide content lives in `src/lib/developer-guide.ts`.

## Additional Documentation

- **IMPROVEMENTS.md** — Backlog and architectural decision log
- **CLAUDE.md** — AI-readable project conventions
- **.env.example** — Full environment variable reference
- **prisma/schema.prisma** — Schema with inline documentation explaining naming mismatches
