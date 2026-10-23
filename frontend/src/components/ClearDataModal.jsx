import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

/**
 * Destructive confirm dialog. User must type DELETE to enable confirm.
 */
export default function ClearDataModal({
  open,
  title,
  description,
  confirmLabel = "Clear all data",
  busy = false,
  onClose,
  onConfirm,
  testId = "clear-data-modal",
}) {
  const [text, setText] = useState("");
  if (!open) return null;

  const canConfirm = text.trim().toUpperCase() === "DELETE" && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-testid={testId}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-200">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-xs text-slate-600">
            Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm. This permanently removes records from the database and cannot be undone.
          </p>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="DELETE"
            disabled={busy}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold tracking-wide veritech-focus"
            data-testid={`${testId}-confirm-input`}
            autoFocus
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
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
            disabled={!canConfirm}
            onClick={() => onConfirm()}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
            data-testid={`${testId}-confirm`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
