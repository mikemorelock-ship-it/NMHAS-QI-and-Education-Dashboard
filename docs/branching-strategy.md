# Branching Strategy & Branch Protection

## Branch Naming Conventions

- `main` — Production-ready, always deployable
- `feature/<name>` — New features (e.g., `feature/audit-log-viewer`)
- `fix/<name>` — Bug fixes (e.g., `fix/pagination-off-by-one`)
- `chore/<name>` — Tooling, deps, maintenance (e.g., `chore/update-dependencies`)

## Workflow

1. Create branch from `main`
2. Make changes, commit with conventional commit messages
3. Push branch, open PR
4. CI runs automatically (lint, typecheck, test, build)
5. Review, approve, merge (squash merge recommended)

## Conventional Commits

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type: description

feat: add audit log viewer page
fix: correct pagination offset calculation
docs: update branching strategy
style: format codebase with Prettier
refactor: extract audit helper utility
perf: add indexes to AuditLog table
test: add permissions test coverage
build: add Prettier and ESLint config
ci: add GitHub Actions CI workflow
chore: update dependencies
revert: undo previous commit
```

## Recommended Branch Protection (GitHub Settings)

Go to: **Settings > Branches > Add branch protection rule**

### Rule: `main`

1. **Require a pull request before merging**: Yes
   - Required approvals: 1 (or 0 if solo developer)
   - Dismiss stale pull request approvals: Yes
2. **Require status checks to pass before merging**: Yes
   - Required checks: `quality` (the CI job name)
   - Require branches to be up to date: Yes
3. **Require conversation resolution before merging**: Yes
4. **Do not allow bypassing the above settings**: No (allow admin bypass for emergencies)
