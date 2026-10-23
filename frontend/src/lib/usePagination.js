import { useEffect, useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Client-side pagination for list/table views.
 * @param {Array} items
 * @param {{ pageSize?: number, resetKey?: string|number }} [options]
 * Pass resetKey (e.g. search/filter string) to jump back to page 1 when filters change.
 */
export default function usePagination(items, options = {}) {
  const pageSizeOption = typeof options === "number" ? options : options.pageSize;
  const resetKey = typeof options === "number" ? undefined : options.resetKey;

  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const [pageSize, setPageSize] = useState(Math.max(1, Number(pageSizeOption) || DEFAULT_PAGE_SIZE));
  const size = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, size]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  }, [list, page, size]);

  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  return {
    page,
    setPage,
    pageSize: size,
    setPageSize,
    total,
    totalPages,
    pageItems,
    from,
    to,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}

export { DEFAULT_PAGE_SIZE };
