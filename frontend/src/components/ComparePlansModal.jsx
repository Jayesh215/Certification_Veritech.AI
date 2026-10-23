import { useEffect } from "react";
import { X, Check, Minus, Star, Lock } from "lucide-react";
import { api, COMPARISON_FEATURES, formatCurrency, formatDateRange } from "../lib/api";
import { useState } from "react";
import { SkeletonPulse } from "./PageSkeletons";

export default function ComparePlansModal({ open, onClose, onSelect, selectedDuration }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get("/plans").then((r) => setPlans(r.data)).catch(() => {}).finally(() => setLoading(false));
    const onEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
      data-testid="compare-plans-modal"
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Compare certificate plans
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">All plans include an official Veritech.AI credential. Longer durations unlock career perks.</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300"
            data-testid="compare-plans-close-btn"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading && plans.length === 0 ? (
            <div className="space-y-3 p-6" data-testid="compare-plans-skeleton">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <SkeletonPulse className="h-4 w-48" />
                  <SkeletonPulse className="h-4 flex-1" />
                  <SkeletonPulse className="h-4 flex-1" />
                  <SkeletonPulse className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : (
          <table className="w-full border-separate border-spacing-0 text-sm min-w-[720px]">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider text-slate-500 bg-white border-b border-slate-200">
                  Feature
                </th>
                {plans.map((p) => {
                  const isPopular = p.popular;
                  const isSelected = selectedDuration === p.duration_months;
                  const career = p.duration_months === 3 || p.duration_months === 6;
                  return (
                    <th
                      key={p.duration_months}
                      className={`px-4 py-4 text-center border-b border-slate-200 ${
                        isPopular ? "bg-blue-50/60" : "bg-white"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            {p.name}
                          </span>
                          {formatDateRange(p.start_date, p.end_date) && (
                            <span className="block text-[10px] font-medium normal-case tracking-normal text-slate-500">
                              {formatDateRange(p.start_date, p.end_date)}
                            </span>
                          )}
                          {isPopular && (
                            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                              Popular
                            </span>
                          )}
                          {career && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 uppercase tracking-wider">
                              <Star className="h-2.5 w-2.5" /> Career
                            </span>
                          )}
                        </div>
                        <span className="text-xl font-extrabold text-slate-900 font-mono-tabular">
                          {formatCurrency(p.price)}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FEATURES.map((feat, idx) => (
                <tr key={feat.label} className="group">
                  <td
                    className={`px-5 py-3 text-slate-700 ${
                      idx !== COMPARISON_FEATURES.length - 1 ? "border-b border-slate-100" : ""
                    }`}
                  >
                    {feat.label}
                  </td>
                  {plans.map((p) => {
                    const included = feat.in.includes(p.duration_months);
                    const career = p.duration_months === 3 || p.duration_months === 6;
                    return (
                      <td
                        key={p.duration_months}
                        className={`px-4 py-3 text-center ${
                          p.popular ? "bg-blue-50/40" : ""
                        } ${idx !== COMPARISON_FEATURES.length - 1 ? "border-b border-slate-100" : ""}`}
                      >
                        {included ? (
                          <Check className={`inline-block h-4 w-4 ${career ? "text-emerald-600" : "text-blue-600"}`} />
                        ) : (
                          <Minus className="inline-block h-4 w-4 text-slate-300" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-white">
              <tr>
                <td className="px-5 py-4 text-xs text-slate-500 border-t border-slate-200">
                  Choose a plan to continue
                </td>
                {plans.map((p) => {
                  const isSelected = selectedDuration === p.duration_months;
                  return (
                    <td key={p.duration_months} className={`px-4 py-4 text-center border-t border-slate-200 ${p.popular ? "bg-blue-50/40" : ""}`}>
                      <button
                        onClick={() => { onSelect(p.duration_months); onClose(); }}
                        data-testid={`compare-select-${p.duration_months}`}
                        className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                        }`}
                      >
                        {isSelected ? "Selected" : "Choose"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
          )}
        </div>

        {/* Footer badge */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-emerald-600" /> Secure Razorpay checkout
          </span>
          <span>Prices are inclusive of all taxes.</span>
        </div>
      </div>
    </div>
  );
}
