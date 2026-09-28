/**
 * Pagination Utilities
 *
 * PRD §38: Default page sizes 20, 50, 100.
 * PRD §38: Never implement unbounded GET /all for large datasets.
 * ADR-009: Offset pagination for UI lists, cursor for large entity lists.
 */

export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export const PAGE_SIZE_MAX = 100;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/**
 * Parse and validate pagination query params.
 * Falls back to safe defaults if values are invalid.
 */
export function parsePaginationParams(
  page?: string | number | null,
  pageSize?: string | number | null
): PaginationParams {
  const parsedPage = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
  const parsedSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, parseInt(String(pageSize ?? PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT)
  );

  return {
    page: parsedPage,
    pageSize: parsedSize,
  };
}

/**
 * Convert page/pageSize to Prisma skip/take.
 */
export function toPrismaSkipTake(params: PaginationParams): {
  skip: number;
  take: number;
} {
  return {
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
  };
}

/**
 * Build pagination metadata for API responses.
 */
export function buildPaginationMeta(
  total: number,
  params: PaginationParams
): PaginationMeta {
  const totalPages = Math.ceil(total / params.pageSize);
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages,
    hasPreviousPage: params.page > 1,
    hasNextPage: params.page < totalPages,
  };
}

/**
 * Standard paginated API response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    data,
    pagination: buildPaginationMeta(total, params),
  };
}
