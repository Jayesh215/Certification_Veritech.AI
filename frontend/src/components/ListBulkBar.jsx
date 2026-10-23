import { Loader2, Trash2, Eraser } from "lucide-react";

/**
 * Inline bulk actions — only rendered when at least one row is selected.
 * Place beside filter controls in the search/filter row.
 */
export default function ListBulkBar({
  selectedCount,
  busy = false,
  onBulkDelete,
  onClearAll,
  testId = "list-bulk-bar",
}) {
  if (selectedCount <= 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={testId}>
      <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
        {selectedCount} selected
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onBulkDelete}
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
        data-testid={`${testId}-bulk-delete`}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Delete selected
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onClearAll}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
        data-testid={`${testId}-clear-all`}
      >
        <Eraser className="h-3.5 w-3.5" />
        Clear all data
      </button>
    </div>
  );
}
