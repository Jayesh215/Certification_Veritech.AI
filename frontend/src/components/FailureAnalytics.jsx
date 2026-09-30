import { useEffect, useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { api } from "../lib/api";

export default function FailureAnalytics() {
  const [data, setData] = useState(null);
  const [view, setView] = useState("by_description");

  useEffect(() => {
    api.get("/admin/failure-analytics").then((r) => setData(r.data)).catch(() => setData({ total_failed: 0, by_description: [], by_code: [], by_step: [] }));
  }, []);

  if (!data) return null;

  const rows = data[view] || [];
  const max = Math.max(1, ...rows.map((r) => r.count));

  const tabs = [
    { key: "by_description", label: "Reason" },
    { key: "by_code", label: "Code" },
    { key: "by_step", label: "Step" },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="failure-analytics-widget">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-200">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Failure Analytics</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Breakdown of {data.total_failed} failed payment{data.total_failed === 1 ? "" : "s"} by Razorpay signal.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              data-testid={`failure-tab-${t.key}`}
              className={`rounded-md px-2 py-1 font-semibold transition-colors ${
                view === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-slate-700">No failures recorded</p>
            <p className="mt-1 text-xs text-slate-500">Failures will appear here as they are reported by Razorpay.</p>
          </div>
        ) : rows.map((r) => (
          <div key={r.label} className="group">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-700 truncate max-w-md" title={r.label}>{r.label}</span>
              <span className="font-mono-tabular font-bold text-slate-900">{r.count}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-red-500/80 group-hover:bg-red-500 transition-colors"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <a
        href="/admin/payments"
        className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
      >View failed payments <ChevronRight className="h-3 w-3" /></a>
    </div>
  );
}
