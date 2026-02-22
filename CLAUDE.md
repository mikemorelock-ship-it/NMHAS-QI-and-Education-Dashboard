# CLAUDE.md

Project context and guidelines for AI-assisted development.

## Project Overview

NMHAS QI and Education Dashboard — a Next.js 15 app with TypeScript, Prisma (SQLite), and Tailwind CSS. Tracks EMS quality improvement metrics, scorecards, and FTO education programs.

## Git Commit Conventions

This project enforces **Conventional Commits** via CommitLint + Husky.

### Commit message format

```
<type>: <short description>

<optional body>
```

### Allowed types

| Type       | Use for                                  |
| ---------- | ---------------------------------------- |
| `feat`     | New feature                              |
| `fix`      | Bug fix                                  |
| `docs`     | Documentation only                       |
| `style`    | Formatting, whitespace (no logic change) |
| `refactor` | Code restructure (no feature or fix)     |
| `perf`     | Performance improvement                  |
| `test`     | Adding or updating tests                 |
| `build`    | Build system or dependency changes       |
| `ci`       | CI/CD pipeline changes                   |
| `chore`    | Maintenance tasks, tooling               |
| `revert`   | Reverting a previous commit              |

### Rules

- Subject line: imperative mood, lowercase start, no trailing period
- Keep the subject under 72 characters
- Use the body to explain **why**, not just what
- The `commit-msg` hook runs `commitlint` — non-conforming messages will be rejected

## Branch & PR Workflow

### Branch naming

- `main` — production branch, always deployable
- Feature branches: `<author-or-tool>/<short-description>` (e.g. `claude/ems-dashboard-improvements-GTzpo`)

### Pull request process

1. Create a feature branch off `main`
2. Make commits following the conventions above
3. Open a PR using the repo's PR template (`.github/pull_request_template.md`)
4. PR description must include: summary, change list, type of change, testing evidence, and database impact
5. Merge into `main` when approved

## Git Safety Rules

- **Never force-push** (`git push --force`) to `main`
- **Never push directly to `main`** — always use a PR
- **Never skip hooks** (`--no-verify`) unless explicitly told to
- **Never amend published commits** — create a new commit instead
- **Never run destructive commands** (`git reset --hard`, `git clean -f`, `git checkout .`) without explicit approval
- When a pre-commit hook fails, fix the issue and create a **new** commit (do not `--amend`)
- Prefer staging specific files (`git add <file>`) over `git add -A` or `git add .`

## Pre-commit Hooks

Husky runs these hooks automatically:

- **pre-commit**: `lint-staged` formats and lints staged files
  - `*.{ts,tsx}` → Prettier + ESLint
  - `*.{json,md,css,mjs}` → Prettier
- **commit-msg**: `commitlint` validates the commit message

## Common Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format
npm run format:check # Prettier check
npx prisma studio    # Database browser
npx prisma db push   # Apply schema changes
npx prisma db seed   # Seed the database
```
