// ---------------------------------------------------------------------------
// Developer Guide — Structured content for the technical documentation page.
//
// This module contains all sections of the developer guide as data. The
// corresponding page component renders them. To add or update a section,
// edit or append to the GUIDE_SECTIONS array below.
//
// This guide exists for continuity planning: if the original developer is
// unavailable, a successor should be able to understand the codebase, its
// patterns, and its quirks from this document alone (plus the schema and
// inline comments).
// ---------------------------------------------------------------------------

export interface GuideSection {
  id: string;
  title: string;
  icon: string; // lucide-react icon name
  content: string; // markdown-ish content (rendered as structured HTML)
  subsections?: GuideSubsection[];
}

export interface GuideSubsection {
  id: string;
  title: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Guide content
// ---------------------------------------------------------------------------

export const GUIDE_SECTIONS: GuideSection[] = [
  // =========================================================================
  // 1. PROJECT OVERVIEW
  // =========================================================================
  {
    id: "overview",
    title: "Project Overview",
    icon: "LayoutDashboard",
    content:
      "The NMH EMS Operations Dashboard is a full-stack web application built for North Memorial Health's EMS division. It provides real-time operational metrics, quality improvement tools, scorecards, and a complete Field Training & Evaluation Program (FTEP) management system.",
    subsections: [
      {
        id: "overview-purpose",
        title: "Purpose",
        content:
          "This application replaces manual spreadsheet-based tracking with a unified, role-based platform. It serves three distinct user groups through three portals:\n\n" +
          "• Public Dashboard — Read-only operational metrics, scorecards, QI tools, and field training analytics. Accessible to all authenticated users with dashboard roles (admin, manager, data_entry).\n\n" +
          "• Admin Portal — Full CRUD management of departments, metrics, scorecards, QI campaigns, field training configuration, user management, and audit logging. Restricted to admin (and some manager/data_entry) roles.\n\n" +
          "• Field Training Portal — DOR (Daily Observation Report) creation, trainee evaluation, skill tracking, coaching activities, and trainee snapshots. Used by FTOs, supervisors, and trainees.",
      },
      {
        id: "overview-stack",
        title: "Technology Stack",
        content:
          "• Next.js 16 (App Router, Turbopack) — React 19 server components, server actions, streaming\n" +
          "• Prisma 7 — ORM with SQLite (local via better-sqlite3, production via Turso/libSQL)\n" +
          "• shadcn/ui + Radix UI — Component library with accessible primitives\n" +
          "• Tailwind CSS 4 — Utility-first styling\n" +
          "• Recharts — Charting library for metrics, SPC charts, and analytics\n" +
          "• @dnd-kit — Drag-and-drop for Kanban-style interfaces\n" +
          "• jose — JWT creation/verification (Edge-compatible, no native deps)\n" +
          "• bcryptjs — Password hashing (pure JS, no native deps)\n" +
          "• Zod 4 — Runtime schema validation for all server actions\n" +
          "• Vitest — Unit testing framework\n" +
          "• Husky + lint-staged + commitlint — Git hooks for code quality",
      },
      {
        id: "overview-running",
        title: "Running the Application",
        content:
          "Prerequisites: Node.js (v20+), npm\n\n" +
          "1. Clone the repository and cd into ems-dashboard/\n" +
          "2. Copy .env.example to .env and configure (see .env.example for all options)\n" +
          "3. npm install\n" +
          "4. npx prisma migrate dev (creates/updates the SQLite database)\n" +
          "5. node --import tsx prisma/seed.mjs (populates dev data)\n" +
          "6. npm run dev (starts dev server on localhost:3000)\n\n" +
          "Default admin login: michael.morelock@northmemorial.com / Admin123!\n" +
          "All seed users use the password Admin123!\n\n" +
          "The database file is stored at the path specified by DATABASE_URL in .env. For local development, this is typically: C:\\Users\\<you>\\.local\\ems-dashboard\\dev.db",
      },
    ],
  },

  // =========================================================================
  // 2. ARCHITECTURE
  // =========================================================================
  {
    id: "architecture",
    title: "Architecture & Routing",
    icon: "GitBranchPlus",
    content:
      "The application uses Next.js App Router with route groups to implement three distinct portals, each with its own layout, navigation, loading states, and error boundaries.",
    subsections: [
      {
        id: "arch-route-groups",
        title: "Route Groups",
        content:
          "Next.js route groups (parenthesized directories) allow separate layouts without affecting the URL path:\n\n" +
          "• (public)/ — The main dashboard. Routes: /, /department/*, /metric/*, /scorecards, /field-training, /quality-improvement/*\n" +
          "• (admin)/admin/* — The admin portal. Routes: /admin, /admin/users, /admin/metrics, etc.\n" +
          "• (field-training)/fieldtraining/* — The field training portal. Routes: /fieldtraining, /fieldtraining/dors/*, /fieldtraining/skills, etc.\n\n" +
          "Each route group has its own layout.tsx, loading.tsx (the custom ambulance loader), and error.tsx. A new page added inside a route group automatically inherits that group's layout and loading states — you don't need to configure anything extra.\n\n" +
          "IMPORTANT: The (admin) route group wraps the /login and /register pages too, since those share the unauthenticated layout. Don't confuse (admin) the route group with /admin the URL prefix.",
      },
      {
        id: "arch-middleware",
        title: "Middleware (src/middleware.ts)",
        content:
          "The middleware runs on the Edge runtime and handles:\n\n" +
          "1. CORS — Whitelisted origins for API routes (localhost in dev, NEXT_PUBLIC_SITE_URL in prod)\n" +
          "2. Authentication — Every route (except /login, /register, static assets, /api/public/*) requires a valid JWT session cookie. Invalid/expired tokens redirect to /login; API routes get a 401.\n" +
          "3. API Rate Limiting — 60 requests per minute per IP for /api/* routes, in-memory tracking.\n\n" +
          "CRITICAL QUIRK: The middleware cannot import src/lib/env.ts because env.ts uses Node.js APIs that aren't available in the Edge runtime. Instead, it constructs JWT_SECRET directly from process.env. The same env var is validated at app startup by env.ts, so this duplication is intentional and safe.\n\n" +
          "The matcher config excludes login, register, _next/static, _next/image, favicon.ico, and api/public from authentication.",
      },
      {
        id: "arch-page-pattern",
        title: "Server/Client Component Pattern",
        content:
          "Every page follows this pattern:\n\n" +
          "1. page.tsx (server component) — Does auth guard, fetches data from Prisma, serializes dates to ISO strings, passes data to the client component.\n" +
          "2. *-client.tsx (client component) — Receives serialized data as props, handles all interactivity (state, forms, modals, etc.).\n\n" +
          "This split exists because server components can directly call Prisma and access server-only APIs, while client components can use hooks, event handlers, and browser APIs. Dates must be serialized to ISO strings when crossing the server→client boundary because Date objects can't be serialized in React server component props.\n\n" +
          "Example:\n" +
          "  page.tsx: const users = await prisma.user.findMany(...);\n" +
          "  return <UsersClient users={users.map(u => ({...u, createdAt: u.createdAt.toISOString()}))} />;",
      },
    ],
  },

  // =========================================================================
  // 3. DATA MODEL
  // =========================================================================
  {
    id: "data-model",
    title: "Data Model & Naming",
    icon: "Building2",
    content:
      "The data model has a naming mismatch between the database and the UI that is the single biggest source of confusion for new developers. This section explains the hierarchy clearly.",
    subsections: [
      {
        id: "dm-hierarchy",
        title: "Organizational Hierarchy (THE NAMING CONFUSION)",
        content:
          "The database uses different names than the UI for historical reasons. Here is the mapping:\n\n" +
          "DATABASE MODEL → DB TABLE → UI LABEL → EXAMPLE\n" +
          'Department → Department → (hidden) → "EMS Operations" (legacy top-level, kept for FK constraints)\n' +
          'Division → Division → "Division" → "Air Care Clinical", "Ground Ambulance"\n' +
          'Region → Individual → "Department" → "AC 1", "Brainerd", "Quality"\n\n' +
          "KEY POINTS:\n" +
          "• The Prisma model 'Region' maps to the database table 'Individual' via @@map(\"Individual\"). This is because the table was originally called Individual but was renamed to Region in the code for clarity.\n" +
          "• In the UI, what users see as 'Department' is actually the Region/Individual entity.\n" +
          "• The actual Department model is hidden from the UI and exists only as a legacy FK parent.\n" +
          "• Division is the same name in both the DB and UI — it's the top-level visible unit.\n\n" +
          "When writing code: use the Prisma model names (Department, Division, Region) in your code. When writing UI labels, use Division and Department (where Department = Region in the code).",
      },
      {
        id: "dm-user-model",
        title: "Unified User Model",
        content:
          "There is a single User model with 6 roles: admin, manager, data_entry, supervisor, fto, trainee.\n\n" +
          "IMPORTANT HISTORY: The codebase originally had separate admin and FTO user models. These were unified into a single User model (IMPROVEMENTS.md item #29). Legacy type aliases (AdminSession, AdminRole, FtoRole, etc.) and function aliases (requireAdmin, hasAdminPermission, hasFtoPermission) still exist throughout the codebase for backward compatibility. They all point to the same underlying types and functions.\n\n" +
          "When you see requireAdmin('manage_users') in a server action, it's calling requirePermission('manage_users') — they're the same function. Don't be confused by the old naming.\n\n" +
          "Role-based routing after login:\n" +
          "• admin, manager, data_entry → / (public dashboard)\n" +
          "• supervisor, fto, trainee → /fieldtraining (field training portal)\n\n" +
          "All roles can access the field training portal. Only admin/manager/data_entry can access the public dashboard and admin portal.",
      },
      {
        id: "dm-session-version",
        title: "Session Version Mechanism",
        content:
          "Each User has a sessionVersion integer (starts at 0). When a JWT is created, the current sessionVersion is embedded as the 'sv' claim.\n\n" +
          "On every authenticated request, verifySession() reads the JWT, then queries the database to compare the token's 'sv' with the user's current sessionVersion. If they don't match, the session is rejected.\n\n" +
          "sessionVersion is incremented when:\n" +
          "• The user changes their password\n" +
          "• The user's role is changed by an admin\n" +
          "• The user's account is disabled\n\n" +
          "This means ALL existing sessions for that user are immediately invalidated. This is an intentional security-over-performance trade-off: every verifySession() call makes a database query. This is acceptable for our scale.\n\n" +
          "WHY NOT JUST USE JWT EXPIRY? JWT expiry alone means a compromised token is valid for up to 24 hours even after a password change. The session version mechanism provides immediate invalidation.",
      },
      {
        id: "dm-prisma-adapter",
        title: "Prisma v7 Adapter Requirement",
        content:
          "Prisma v7 with the 'prisma-client' generator (our configuration) requires a driver adapter. You cannot just do new PrismaClient() — it will throw an error about requiring either an adapter or accelerateUrl.\n\n" +
          "The correct pattern (in src/lib/db.ts):\n" +
          "• For local SQLite: new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) })\n" +
          "• For Turso (production): new PrismaClient({ adapter: new PrismaLibSql({ url, authToken }) })\n\n" +
          "db.ts detects which adapter to use based on the DATABASE_URL prefix (file: vs libsql:// or https://).\n\n" +
          "QUIRK: The adapter imports use CommonJS require() instead of ES import. This is because createPrismaClient() is a synchronous factory function (needed for the global singleton pattern), and dynamic import() would require it to be async. The eslint-disable comments are intentional.\n\n" +
          "The Prisma client is generated to src/generated/prisma/. DO NOT EDIT FILES IN THIS DIRECTORY — they are overwritten every time you run prisma generate (which happens automatically during npm run build).",
      },
    ],
  },

  // =========================================================================
  // 4. AUTH & SECURITY
  // =========================================================================
  {
    id: "auth-security",
    title: "Authentication & Security",
    icon: "Shield",
    content:
      "The application uses a custom JWT-based authentication system with defense-in-depth security measures.",
    subsections: [
      {
        id: "auth-flow",
        title: "Authentication Flow",
        content:
          "1. User submits email + password to loginAction (server action)\n" +
          "2. Server verifies credentials with bcrypt, checks account status and rate limiting\n" +
          "3. On success: creates a JWT with user info + session version, sets httpOnly cookie\n" +
          "4. Cookie name: 'session', expires in 24 hours, httpOnly, secure in prod, sameSite=lax\n" +
          "5. On each request: middleware checks JWT signature/expiry; verifySession() also checks session version against DB\n\n" +
          "Login rate limiting: After 5 failed attempts for a given email, the account is locked for 15 minutes. Tracked in the LoginAttempt table.\n\n" +
          "Session timeout: A client-side IdleTimeout component logs out the user after 30 minutes of inactivity. A SessionTimeoutWarning component shows a warning 5 minutes before the JWT expires.",
      },
      {
        id: "auth-permissions",
        title: "Permission System (RBAC)",
        content:
          "src/lib/permissions.ts is the SINGLE SOURCE OF TRUTH for all permissions.\n\n" +
          "The PERMISSIONS object maps each permission name to an array of roles that have it. For example:\n" +
          "  manage_users: ['admin']\n" +
          "  enter_metric_data: ['admin', 'data_entry']\n" +
          "  create_edit_own_dors: ['fto', 'supervisor', 'manager', 'admin']\n\n" +
          "Usage patterns:\n" +
          "• Server actions: const session = await requirePermission('manage_users');\n" +
          "• Page guards: if (!hasPermission(session.role, 'manage_users')) { notFound(); }\n" +
          "• UI filtering: {hasPermission(role, 'manage_users') && <AdminButton />}\n\n" +
          "BACKWARD-COMPAT ALIASES: requireAdmin = requirePermission, hasAdminPermission = hasPermission, hasFtoPermission = hasPermission. These exist throughout the codebase from the unified-user migration. They are functionally identical.",
      },
      {
        id: "auth-csrf",
        title: "CSRF Protection",
        content:
          "src/lib/csrf.ts implements explicit Origin header validation for server actions.\n\n" +
          "Next.js 14+ already validates the Origin header on server actions, but we add an explicit check as defense-in-depth. The check validates that the Origin header matches the expected host.\n\n" +
          "Three conditions pass CSRF validation:\n" +
          "1. Origin header matches the expected host\n" +
          "2. No Origin header (non-browser clients, same-origin navigation)\n" +
          "3. Origin header cannot be parsed (fail-open to avoid breaking legitimate requests)\n\n" +
          "Server actions call verifyCsrf() at the top before any data mutation.",
      },
      {
        id: "auth-security-headers",
        title: "Security Headers",
        content:
          "next.config.ts sets security headers on all responses:\n\n" +
          "• X-Content-Type-Options: nosniff\n" +
          "• X-Frame-Options: DENY\n" +
          "• X-XSS-Protection: 1; mode=block\n" +
          "• Referrer-Policy: strict-origin-when-cross-origin\n" +
          "• Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n" +
          "These headers prevent clickjacking, MIME sniffing, and restrict browser permissions.",
      },
    ],
  },

  // =========================================================================
  // 5. PATTERNS & CONVENTIONS
  // =========================================================================
  {
    id: "patterns",
    title: "Patterns & Conventions",
    icon: "ClipboardList",
    content:
      "The codebase follows consistent patterns for server actions, error handling, and audit logging. Understanding these patterns is essential for adding new features.",
    subsections: [
      {
        id: "patterns-server-actions",
        title: "Server Action Pattern",
        content:
          "Every server action follows this exact sequence:\n\n" +
          "1. 'use server' directive at the top of the file\n" +
          "2. Zod schema validation of inputs\n" +
          "3. Permission guard: await requirePermission('permission_name')\n" +
          "4. Prisma database operation\n" +
          "5. Audit log: await prisma.auditLog.create({ data: { action, entityType, entityId, actorId, actorType, changes } })\n" +
          "6. revalidatePath('/affected/path')\n" +
          "7. Return ActionResult: { success: true } or { success: false, error: 'message' }\n\n" +
          "NOTE ON ActionResult: The ActionResult type is defined locally in each action file rather than as a shared type. Most files use { success: boolean; error?: string }. Some files extend it with data? or count? fields. This is intentional duplication — each action file is self-contained.\n\n" +
          "Error handling: All actions wrap database operations in try/catch and use handleActionError() from src/lib/safe-error.ts to sanitize Prisma errors (e.g., unique constraint violations become user-friendly messages).",
      },
      {
        id: "patterns-audit-log",
        title: "Audit Logging",
        content:
          "Every CREATE, UPDATE, and DELETE operation is logged to the AuditLog table with:\n\n" +
          "• action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | etc.\n" +
          "• entityType: 'User' | 'MetricEntry' | 'DOR' | etc.\n" +
          "• entityId: the ID of the affected record\n" +
          "• actorId: the ID of the user who performed the action\n" +
          "• actorType: 'admin' | 'system'\n" +
          "• changes: JSON string of before/after values (for UPDATEs)\n\n" +
          "The audit log is viewable at /admin/audit-log with filtering by action, entity, actor, and date range. Expandable rows show structured before/after diffs.\n\n" +
          "IMPORTANT: The audit log is append-only — there is no mechanism to delete entries. This is intentional for compliance and accountability.",
      },
      {
        id: "patterns-error-boundary",
        title: "Error Handling & Boundaries",
        content:
          "The application uses multiple layers of error handling:\n\n" +
          "1. Server action errors — Caught and returned as ActionResult with user-friendly messages via handleActionError()\n" +
          "2. Page-level error.tsx — Each route group has an error.tsx boundary that catches rendering errors and shows a recovery UI\n" +
          "3. Global error boundary — src/app/global-error.tsx catches errors outside route groups\n" +
          "4. Loading states — Each route group has a loading.tsx with the custom ambulance animation, automatically used for all pages in the group via Next.js streaming\n\n" +
          "handleActionError() (src/lib/safe-error.ts) specifically handles:\n" +
          "• Prisma unique constraint violations → 'A record with this [field] already exists'\n" +
          "• Prisma foreign key violations → 'Related record not found'\n" +
          "• All other errors → Generic 'An unexpected error occurred' (no stack traces exposed to client)",
      },
      {
        id: "patterns-pagination",
        title: "Pagination",
        content:
          "src/lib/pagination.ts provides a reusable paginatedQuery() function that wraps Prisma queries with LIMIT/OFFSET pagination.\n\n" +
          "It runs the count query and data query in parallel with Promise.all for performance. Page numbers are clamped to valid ranges (if you request page 99 but there are only 5 pages, it returns page 5).\n\n" +
          "Usage: const { data, pagination } = await paginatedQuery(prisma.user, { where: {...} }, { page, perPage });\n\n" +
          "The pagination object includes: currentPage, totalPages, totalCount, perPage, hasNext, hasPrev.",
      },
      {
        id: "patterns-spc",
        title: "Statistical Process Control (SPC)",
        content:
          "src/lib/spc.ts implements three SPC chart types used in quality improvement:\n\n" +
          "• P-chart — Proportion/rate metrics (e.g., defect rates)\n" +
          "• U-chart — Count-per-unit metrics (e.g., incidents per transport)\n" +
          "• I-MR chart — Individual measurement with moving range (e.g., response times)\n\n" +
          "Each chart type calculates upper and lower control limits (UCL/LCL) and center lines using standard statistical formulas. These are displayed as reference lines on metric trend charts.\n\n" +
          "This is domain-specific healthcare quality improvement math. The formulas follow standard SPC methodology — don't modify them unless you understand the statistical implications.",
      },
    ],
  },

  // =========================================================================
  // 6. KEY MODULES
  // =========================================================================
  {
    id: "key-modules",
    title: "Key Modules & Files",
    icon: "FileText",
    content:
      "A reference map of the most important files and what they do. When you need to understand or modify a behavior, start here.",
    subsections: [
      {
        id: "modules-lib",
        title: "src/lib/ (Core Libraries)",
        content:
          "• auth.ts — Session creation, verification, password hashing. Contains verifySession() which is called on every authenticated request.\n" +
          "• db.ts — Prisma client singleton with adapter auto-detection (SQLite vs Turso).\n" +
          "• env.ts — Environment variable validation. Crashes fast on missing required vars.\n" +
          "• permissions.ts — RBAC permission matrix. THE source of truth for who can do what.\n" +
          "• require-auth.ts — Server action auth guards (requirePermission, requireAuth).\n" +
          "• csrf.ts — Origin header validation for server actions.\n" +
          "• rate-limit.ts — Login attempt rate limiting (5 attempts, 15-min lockout).\n" +
          "• pagination.ts — Reusable paginated query wrapper for Prisma.\n" +
          "• safe-error.ts — Error sanitization for server actions (handleActionError).\n" +
          "• api-response.ts — Standardized API response helpers.\n" +
          "• aggregation.ts — Statistical aggregation functions (sum, mean, median, etc.).\n" +
          "• spc.ts — SPC chart calculations (P-chart, U-chart, I-MR).\n" +
          "• constants.ts — App-wide constants (DOR rating labels, phase names, etc.).\n" +
          "• utils.ts — General utilities including toUTCDate() (see Known Quirks).\n" +
          "• help-registry.ts — Help page content registry.\n" +
          "• changelog.ts — Release changelog data.\n" +
          "• developer-guide.ts — This developer guide's content (you're reading it).",
      },
      {
        id: "modules-actions",
        title: "src/actions/ (Server Actions)",
        content:
          "15 action files, each responsible for a domain:\n\n" +
          "• auth.ts — Login, logout, register, user CRUD, password change\n" +
          "• metrics.ts — Metric definition CRUD\n" +
          "• entries.ts — Metric data entry CRUD, bulk operations\n" +
          "• metric-detail.ts — Metric detail page data fetching\n" +
          "• departments.ts — Division and Region (UI: Department) CRUD\n" +
          "• divisions.ts — Division management\n" +
          "• individuals.ts — Region/Individual (UI: Department) management\n" +
          "• scorecards.ts — Scorecard configuration\n" +
          "• campaigns.ts — QI campaign CRUD\n" +
          "• driver-diagrams.ts — Driver diagram tree management\n" +
          "• pdsa-cycles.ts — PDSA cycle CRUD\n" +
          "• field-training.ts — DOR CRUD, trainee/FTO management, skill signoffs\n" +
          "• coaching.ts — Coaching activity assignment and completion\n" +
          "• snapshots.ts — Trainee snapshot generation\n" +
          "• resources.ts — Resource links and documents",
      },
      {
        id: "modules-middleware",
        title: "Middleware & Configuration",
        content:
          "• src/middleware.ts — Auth, CORS, rate limiting (Edge runtime)\n" +
          "• next.config.ts — Security headers, image domains, experimental flags\n" +
          "• prisma/schema.prisma — Database schema with inline documentation\n" +
          "• prisma/seed.mjs — Development data seeder (run with: node --import tsx prisma/seed.mjs)\n" +
          "• .env.example — Documented environment variable template\n" +
          "• scripts/migrate-deploy.mjs — Production migration script (runs during build)",
      },
    ],
  },

  // =========================================================================
  // 7. DEVELOPMENT WORKFLOW
  // =========================================================================
  {
    id: "workflow",
    title: "Development Workflow",
    icon: "Wand2",
    content: "Tools, scripts, and processes for day-to-day development.",
    subsections: [
      {
        id: "workflow-scripts",
        title: "npm Scripts",
        content:
          "• npm run dev — Start dev server (Turbopack, fast refresh)\n" +
          "• npm run build — prisma generate + migrate deploy + next build (production build)\n" +
          "• npm run lint / lint:fix — ESLint checking and auto-fix\n" +
          "• npm run format / format:check — Prettier formatting\n" +
          "• npm run typecheck — TypeScript type checking (no emit)\n" +
          "• npm run test / test:watch / test:coverage — Vitest test suite\n" +
          "• npm run db:migrate — prisma migrate dev (create new migration)\n" +
          "• npm run db:seed — Run the seed script\n" +
          "• npm run db:reset — Reset database and re-run all migrations (DESTRUCTIVE)\n" +
          "• npm run security:audit — npm audit for production dependencies",
      },
      {
        id: "workflow-git-hooks",
        title: "Git Hooks (Husky + lint-staged)",
        content:
          "Pre-commit hooks are configured via Husky and lint-staged:\n\n" +
          "On every commit:\n" +
          "• All staged .ts and .tsx files are auto-formatted with Prettier and auto-fixed with ESLint\n" +
          "• All staged .json, .md, .css, and .mjs files are auto-formatted with Prettier\n" +
          "• commitlint enforces conventional commit message format\n\n" +
          "If the pre-commit hook fails, the commit is aborted. Fix the issues and commit again.\n\n" +
          "To skip hooks in an emergency: git commit --no-verify (but avoid this — the hooks exist to maintain quality).",
      },
      {
        id: "workflow-testing",
        title: "Testing",
        content:
          "Tests are in __tests__/lib/ and cover the pure-function library modules:\n\n" +
          "• aggregation.test.ts — Statistical aggregation functions\n" +
          "• spc.test.ts — SPC chart calculations\n" +
          "• pagination.test.ts — Paginated query logic\n" +
          "• safe-error.test.ts — Error sanitization\n" +
          "• And others for utility functions\n\n" +
          "Tests use Vitest with V8 coverage. Run: npm run test (single run) or npm run test:watch (watch mode).\n\n" +
          "NOTE: There are no integration tests or end-to-end tests currently. Server actions are tested via their underlying utility functions rather than HTTP calls. Adding E2E tests (e.g., Playwright) would be a valuable improvement.",
      },
      {
        id: "workflow-migrations",
        title: "Database Migrations",
        content:
          "Prisma manages database schema changes through migrations:\n\n" +
          "1. Edit prisma/schema.prisma\n" +
          "2. Run: npx prisma migrate dev --name descriptive-name\n" +
          "3. Prisma creates a migration SQL file in prisma/migrations/\n" +
          "4. The migration is applied immediately to your dev database\n\n" +
          "In production, migrations run automatically during npm run build (via scripts/migrate-deploy.mjs).\n\n" +
          "IMPORTANT: Never manually edit migration files after they've been created. If you need to change a migration, create a new one.\n\n" +
          "To reset everything: npm run db:reset (drops the database, re-runs all migrations, re-seeds).",
      },
      {
        id: "workflow-seed",
        title: "Seed Data",
        content:
          "prisma/seed.mjs creates realistic development data:\n\n" +
          "• Organizational structure (Department → Divisions → Regions)\n" +
          "• Metric definitions with historical data entries\n" +
          "• Users across all 6 roles (all use password: Admin123!)\n" +
          "• QI campaigns, driver diagrams, PDSA cycles\n" +
          "• Field training data (trainees, FTOs, DORs, skills)\n\n" +
          "The seed uses a deterministic random number generator (createSeededRandom) so that re-running the seed produces the same data. This makes development screenshots and demos reproducible.\n\n" +
          "The seed file uses .mjs extension and must be run with node --import tsx because the Prisma v7 generated client uses ESM-only import.meta.url syntax that tsx in CJS mode cannot handle.",
      },
    ],
  },

  // =========================================================================
  // 8. KNOWN QUIRKS & GOTCHAS
  // =========================================================================
  {
    id: "quirks",
    title: "Known Quirks & Gotchas",
    icon: "AlertTriangle",
    content:
      "Non-obvious behaviors, workarounds, and things that will trip you up if you don't know about them.",
    subsections: [
      {
        id: "quirks-naming",
        title: "Naming Mismatch (Department/Division/Region)",
        content:
          "Already covered in the Data Model section, but worth repeating: what the UI calls 'Department' is Region in the code and 'Individual' in the database table. The Prisma model Department is hidden from the UI entirely. This will confuse you. Refer to the Data Model section's mapping table frequently.",
      },
      {
        id: "quirks-backward-compat",
        title: "Backward-Compatibility Aliases",
        content:
          "These aliases exist throughout the codebase from the user model unification:\n\n" +
          "TYPE ALIASES: AdminPermission = Permission, AdminRole = UserRole, FtoRole = UserRole, FtoPermission = Permission, AdminSession = Session\n\n" +
          "FUNCTION ALIASES: requireAdmin = requirePermission, requireAdminSession = requireAuth, hasAdminPermission = hasPermission, hasFtoPermission = hasPermission\n\n" +
          "LABEL ALIASES: ADMIN_ROLE_LABELS = ROLE_LABELS, ADMIN_ROLES = USER_ROLES\n\n" +
          "These are ALL identical to their non-prefixed counterparts. If you're adding new code, use the canonical names (Permission, UserRole, requirePermission, hasPermission). The aliases exist so that hundreds of existing call sites didn't need to be updated during the migration.",
      },
      {
        id: "quirks-utc-date",
        title: "toUTCDate() — The Timezone Fix",
        content:
          "src/lib/utils.ts contains a toUTCDate() function that exists to fix a specific bug:\n\n" +
          "When a date is stored as 'Jan 1 00:00 UTC' and displayed in a US timezone, JavaScript's Date object can show it as 'Dec 31' (the previous day) because of the timezone offset. toUTCDate() adjusts the date to display correctly regardless of the user's timezone.\n\n" +
          "This function looks redundant but is load-bearing. Do not remove it.",
      },
      {
        id: "quirks-generated",
        title: "src/generated/prisma/ — Do Not Edit",
        content:
          "The src/generated/prisma/ directory contains auto-generated TypeScript files produced by prisma generate. These files are overwritten every time you run prisma generate (which happens during npm run build and npx prisma migrate dev).\n\n" +
          "NEVER manually edit anything in this directory. If you need to change the Prisma client types, modify prisma/schema.prisma and regenerate.",
      },
      {
        id: "quirks-require-imports",
        title: "CommonJS require() in db.ts",
        content:
          "src/lib/db.ts uses CommonJS require() to import Prisma adapter packages instead of ES import. This is because:\n\n" +
          "1. The createPrismaClient() function needs to be synchronous (for the global singleton pattern)\n" +
          "2. Dynamic import() would require the function to be async\n" +
          "3. Making it async would break the module-level export: export const prisma = ...\n\n" +
          "The eslint-disable comments on these lines are intentional. Don't try to 'fix' them by converting to import — it will break the singleton pattern.",
      },
      {
        id: "quirks-edge-runtime",
        title: "Edge Runtime Limitations in Middleware",
        content:
          "src/middleware.ts runs on the Edge runtime, which has limitations:\n\n" +
          "• Cannot import Node.js-specific modules (fs, path, etc.)\n" +
          "• Cannot import src/lib/env.ts (uses Node.js APIs)\n" +
          "• Must construct JWT_SECRET directly from process.env\n" +
          "• Cannot use Prisma (no database access in middleware)\n\n" +
          "This is why the middleware only checks JWT validity (signature + expiry) but not session version. The full session version check happens in verifySession() which runs in server components and server actions (Node.js runtime).",
      },
      {
        id: "quirks-action-result",
        title: "ActionResult Type Duplication",
        content:
          "The ActionResult type is defined independently in ~10 different server action files rather than being imported from a shared location. Most define it as { success: boolean; error?: string }, but some extend it:\n\n" +
          "• entries.ts adds count?: number\n" +
          "• metrics.ts and snapshots.ts use a generic: ActionResult<T> with data?: T\n\n" +
          "This is known duplication. Each action file is self-contained, which makes the pattern slightly redundant but means you never need to hunt for a shared type definition.",
      },
      {
        id: "quirks-loading-states",
        title: "Automatic Loading States",
        content:
          "Each route group has a loading.tsx file with the custom ambulance animation. Thanks to Next.js streaming, this loading state is automatically shown for every page in the group while server components are loading.\n\n" +
          "This means if you add a new page inside (admin)/admin/, it gets loading states for free without any configuration. You don't need to add a page-specific loading.tsx unless you want a custom loader.",
      },
    ],
  },

  // =========================================================================
  // 9. DEPLOYMENT
  // =========================================================================
  {
    id: "deployment",
    title: "Deployment & Environment",
    icon: "Settings",
    content:
      "How the application is deployed and the differences between local development and production.",
    subsections: [
      {
        id: "deploy-local",
        title: "Local Development",
        content:
          "Local development uses:\n\n" +
          "• SQLite via better-sqlite3 (file-based, no server needed)\n" +
          "• Database stored at the path in DATABASE_URL (typically C:\\Users\\<you>\\.local\\ems-dashboard\\dev.db)\n" +
          "• Turbopack for fast dev server compilation\n" +
          "• JWT_SECRET from .env (must be set, see .env.example)\n\n" +
          "The dev server auto-reloads on file changes. The Prisma client is cached via globalForPrisma to prevent connection exhaustion during hot module replacement.",
      },
      {
        id: "deploy-production",
        title: "Production (Turso)",
        content:
          "Production deployment uses:\n\n" +
          "• Turso (libSQL) as the database — a distributed SQLite-compatible database\n" +
          "• @prisma/adapter-libsql/web for HTTP-only database access (no native binaries)\n" +
          "• TURSO_AUTH_TOKEN environment variable for authentication\n" +
          "• DATABASE_URL pointing to the Turso libsql:// or https:// endpoint\n\n" +
          "The build script (npm run build) runs:\n" +
          "1. prisma generate — Generates the Prisma client\n" +
          "2. scripts/migrate-deploy.mjs — Applies pending migrations\n" +
          "3. next build — Builds the Next.js application\n\n" +
          "All three steps must succeed for a successful deployment.",
      },
      {
        id: "deploy-env-vars",
        title: "Environment Variables",
        content:
          "Required:\n" +
          "• DATABASE_URL — SQLite file path (file:./dev.db) or Turso URL (libsql://...)\n" +
          "• JWT_SECRET — Minimum 32 characters, generated with: openssl rand -base64 48\n\n" +
          "Optional:\n" +
          "• TURSO_AUTH_TOKEN — Required for Turso/libSQL production database\n" +
          "• NEXT_PUBLIC_SITE_URL — Production URL for CORS (e.g., https://ems.example.com)\n" +
          "• SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM — For email notifications (DOR alerts, etc.)\n\n" +
          "See .env.example for the full list with descriptions and generation instructions.",
      },
    ],
  },

  // =========================================================================
  // 10. FOR THE NEXT DEVELOPER
  // =========================================================================
  {
    id: "next-developer",
    title: "For the Next Developer",
    icon: "Heart",
    content:
      "If you're reading this because the original developer is no longer available, here's what you need to know to take over this project.",
    subsections: [
      {
        id: "next-getting-started",
        title: "Getting Started Checklist",
        content:
          "1. Read the Data Model section — the naming mismatch will confuse you otherwise\n" +
          "2. Read the Auth & Security section — understand how sessions and permissions work\n" +
          "3. Run the seed and explore the app as admin (email: michael.morelock@northmemorial.com, password: Admin123!)\n" +
          "4. Look at one server action file end-to-end to understand the pattern\n" +
          "5. Look at one page.tsx + its -client.tsx to understand the server/client split\n" +
          "6. Read IMPROVEMENTS.md for the history of architectural decisions\n\n" +
          "The codebase follows consistent patterns. Once you understand one server action, page, or component, you understand them all.",
      },
      {
        id: "next-where-things-are",
        title: "Where to Find Things",
        content:
          "• Need to add a permission? → src/lib/permissions.ts (PERMISSIONS object)\n" +
          "• Need to add a page? → src/app/(route-group)/path/page.tsx + page-client.tsx\n" +
          "• Need to add a server action? → src/actions/domain.ts (follow the existing pattern)\n" +
          "• Need to change the schema? → prisma/schema.prisma, then npx prisma migrate dev\n" +
          "• Need to add a UI component? → npx shadcn add [component-name] or src/components/\n" +
          "• Need to update Help content? → src/lib/help-registry.ts (add to HELP_FEATURES or GLOSSARY_TERMS)\n" +
          "• Need to add a changelog entry? → src/lib/changelog.ts (prepend to CHANGELOG array)\n" +
          "• Need to update this guide? → src/lib/developer-guide.ts (edit GUIDE_SECTIONS)",
      },
      {
        id: "next-common-tasks",
        title: "Common Tasks",
        content:
          "ADDING A NEW METRIC:\n" +
          "Admin portal → Metrics → Create New. Or via API: createMetricAction in src/actions/metrics.ts.\n\n" +
          "ADDING A NEW USER ROLE:\n" +
          "1. Add the role to UserRole in src/lib/permissions.ts\n" +
          "2. Add it to each permission in the PERMISSIONS matrix\n" +
          "3. Add it to ROLE_LABELS\n" +
          "4. Add it to USER_ROLES array\n" +
          "5. Update the login redirect logic in src/actions/auth.ts\n" +
          "6. Create a Prisma migration if the role needs schema changes\n\n" +
          "ADDING A NEW ADMIN PAGE:\n" +
          "1. Create src/app/(admin)/admin/your-page/page.tsx (server component, auth guard)\n" +
          "2. Create src/components/admin/your-page-client.tsx (client component)\n" +
          "3. Add to navEntries in src/components/admin/AdminSidebar.tsx\n" +
          "4. Add a help entry in src/lib/help-registry.ts\n\n" +
          "RESETTING THE DATABASE:\n" +
          "npm run db:reset (drops everything, re-runs migrations, then run npm run db:seed to re-seed)",
      },
      {
        id: "next-ai-development",
        title: "AI-Assisted Development Notes",
        content:
          "This application was built using AI-assisted development (Claude by Anthropic). Key implications:\n\n" +
          "• CLAUDE.md in the project root contains AI-readable project conventions and instructions. If you're using an AI coding assistant, keep this file updated.\n" +
          "• The developer's personal memory file (not in the repo) contains environment-specific notes about Node.js PATH issues, Prisma v7 quirks, and Windows-specific workarounds.\n" +
          "• Code follows consistent patterns because the AI was given explicit pattern instructions. Maintain these patterns when adding new features.\n" +
          "• IMPROVEMENTS.md serves as both a backlog and an architectural decision record. Continue updating it when making significant changes.",
      },
      {
        id: "next-improvement-ideas",
        title: "Future Improvement Ideas",
        content:
          "If you're looking for ways to improve the codebase:\n\n" +
          "• Add end-to-end tests with Playwright\n" +
          "• Add API documentation (OpenAPI/Swagger for any API routes)\n" +
          "• Consider extracting shared ActionResult type to src/types/\n" +
          "• Add JSDoc to React component props (especially complex ones like ControlChart, GuidedWizard)\n" +
          "• Add health check endpoint for monitoring\n" +
          "• Consider implementing WebSocket for real-time dashboard updates\n" +
          "• Review and update the backward-compat aliases (can they be removed yet?)\n\n" +
          "Check IMPROVEMENTS.md for the current backlog of planned improvements.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getSectionById(id: string): GuideSection | undefined {
  return GUIDE_SECTIONS.find((s) => s.id === id);
}

export function getTableOfContents(): Array<{
  id: string;
  title: string;
  icon: string;
  subsections: Array<{ id: string; title: string }>;
}> {
  return GUIDE_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    icon: s.icon,
    subsections: s.subsections?.map((sub) => ({ id: sub.id, title: sub.title })) ?? [],
  }));
}
