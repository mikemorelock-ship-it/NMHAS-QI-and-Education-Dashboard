/**
 * Reusable pagination utilities for server-side data fetching.
 *
 * Usage in server components / server actions:
 *   const { page, pageSize } = parsePagination(searchParams);
 *   const { items, pagination } = await paginatedQuery(prisma.user, {
 *     where: { isActive: true },
 *     orderBy: { name: "asc" },
 *   }, page, pageSize);
 *
 * Usage in client components:
 *   <PaginationControls pagination={pagination} />
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Parse pagination params from URL search params or form data
// ---------------------------------------------------------------------------

/**
 * Extract page and pageSize from a searchParams object (or URLSearchParams).
 * Validates and clamps values to safe ranges.
 */
export function parsePagination(
  searchParams?: Record<string, string | string[] | undefined> | URLSearchParams | null,
  defaults?: { pageSize?: number }
): { page: number; pageSize: number } {
  const defaultPageSize = defaults?.pageSize ?? DEFAULT_PAGE_SIZE;

  if (!searchParams) {
    return { page: 1, pageSize: defaultPageSize };
  }

  let rawPage: string | undefined;
  let rawPageSize: string | undefined;

  if (searchParams instanceof URLSearchParams) {
    rawPage = searchParams.get("page") ?? undefined;
    rawPageSize = searchParams.get("pageSize") ?? undefined;
  } else {
    const p = searchParams.page;
    rawPage = Array.isArray(p) ? p[0] : p;
    const ps = searchParams.pageSize;
    rawPageSize = Array.isArray(ps) ? ps[0] : ps;
  }

  let page = rawPage ? parseInt(rawPage, 10) : 1;
  let pageSize = rawPageSize ? parseInt(rawPageSize, 10) : defaultPageSize;

  // Clamp to valid ranges
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(pageSize) || pageSize < MIN_PAGE_SIZE) pageSize = MIN_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return { page, pageSize };
}

// ---------------------------------------------------------------------------
// Generic paginated query helper
// ---------------------------------------------------------------------------

/**
 * Execute a paginated Prisma findMany + count in a single helper.
 *
 * Works with any Prisma model that has `findMany` and `count` methods.
 * The `args` parameter accepts the same shape as `findMany` (where, orderBy,
 * select, include, etc.) — `skip` and `take` are injected automatically.
 *
 * @example
 *   const result = await paginatedQuery(prisma.user, {
 *     where: { isActive: true },
 *     orderBy: { name: "asc" },
 *     select: { id: true, name: true },
 *   }, 1, 25);
 */
export async function paginatedQuery<T>(
  model: {
    findMany: (args: Record<string, unknown>) => Promise<T[]>;
    count: (args: { where?: unknown }) => Promise<number>;
  },
  args: Record<string, unknown>,
  page: number,
  pageSize: number
): Promise<PaginatedResult<T>> {
  const skip = (page - 1) * pageSize;

  // Run count and findMany in parallel for better performance
  const [totalItems, items] = await Promise.all([
    model.count({ where: args.where }),
    model.findMany({ ...args, skip, take: pageSize }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp page to valid range (in case someone passes page=999)
  const clampedPage = Math.min(page, totalPages);

  return {
    items,
    pagination: {
      page: clampedPage,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: clampedPage < totalPages,
      hasPreviousPage: clampedPage > 1,
    },
  };
}

// ---------------------------------------------------------------------------
// URL builder for pagination links
// ---------------------------------------------------------------------------

/**
 * Build a URL search params string with updated page number.
 * Preserves existing search params (filters, search, sort, etc.).
 */
export function buildPaginationUrl(
  basePath: string,
  currentParams: Record<string, string | string[] | undefined>,
  page: number,
  pageSize?: number
): string {
  const params = new URLSearchParams();

  // Copy existing params (except page/pageSize which we'll override)
  for (const [key, value] of Object.entries(currentParams)) {
    if (key === "page" || key === "pageSize") continue;
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }

  params.set("page", String(page));
  if (pageSize && pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(pageSize));
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
