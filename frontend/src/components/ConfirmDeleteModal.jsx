import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

/**
 * Styled confirmation for bulk delete (replaces window.confirm).
 */
export default function ConfirmDeleteModal({
  open,
  title = "Delete selected records?",
  description,
  confirmLabel = "Delete",
  count,
  busy = false,
  onClose,
  onConfirm,
  testId = "confirm-delete-modal",
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      data-testid={testId}
      onClick={() => !busy && onClose?.()}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-200">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {description || (
                  <>
                    Permanently delete{" "}
                    <span className="font-semibold text-slate-800">{count}</span>{" "}
                    record{count === 1 ? "" : "s"} from the database? This cannot be undone.
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            data-testid={`${testId}-cancel`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm?.()}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            data-testid={`${testId}-confirm`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
