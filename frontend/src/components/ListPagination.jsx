import { ChevronLeft, ChevronRight } from "lucide-react";

function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => pages.add(n));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => pages.add(n));
  return [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
}

/**
 * Footer controls for paginated admin lists.
 * Pass the object returned by usePagination().
 */
export default function ListPagination({
  page,
  setPage,
  total,
  totalPages,
  from,
  to,
  hasPrev,
  hasNext,
  pageSize,
  onPageSizeChange,
  label = "rows",
  testId = "list-pagination",
}) {
  if (total === 0) return null;

  const nums = pageNumbers(page, totalPages);

  return (
    <div
      className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid={testId}
    >
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{from}</span>
        –<span className="font-semibold text-slate-700">{to}</span> of{" "}
        <span className="font-semibold text-slate-700">{total}</span> {label}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {typeof onPageSizeChange === "function" && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Per page
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
              data-testid={`${testId}-page-size`}
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => setPage(page - 1)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid={`${testId}-prev`}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>

          {nums.map((n, i) => {
            const prev = nums[i - 1];
            const showEllipsis = prev != null && n - prev > 1;
            return (
              <span key={n} className="flex items-center gap-1">
                {showEllipsis && (
                  <span className="px-1 text-xs text-slate-400" aria-hidden>…</span>
                )}
                <button
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold ${
                    n === page
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  data-testid={`${testId}-page-${n}`}
                >
                  {n}
                </button>
              </span>
            );
          })}

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setPage(page + 1)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid={`${testId}-next`}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
