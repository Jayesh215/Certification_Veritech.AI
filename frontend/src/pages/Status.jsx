import { useState } from "react";
import { toast } from "sonner";
import { Search, Loader2, Download, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api, API_BASE, formatDuration } from "../lib/api";

export default function Status() {
  const [q, setQ] = useState("");
  const [reg, setReg] = useState(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setReg(null);
    try {
      const { data } = await api.get("/registrations/status/lookup", { params: { query: q } });
      setReg(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Not found");
    } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Check registration status</h1>
        <p className="mt-2 text-slate-600">Track your Veritech.AI certificate registration and payment.</p>
      </div>

      <form onSubmit={lookup} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-blue-500">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Registration ID (e.g., VT-2026-000001) or email"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
            data-testid="status-query-input"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          data-testid="status-check-btn"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Check Status
        </button>
      </form>

      {reg && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Registration ID</p>
              <p className="mt-1 text-xl font-bold text-slate-900 font-mono-tabular">{reg.registration_id}</p>
            </div>
            {reg.payment_status === "PAID" ? (
              <a
                href={`${API_BASE}/certificates/${reg.registration_id}/download`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
                data-testid="status-download-certificate-btn"
              >
                <Download className="h-4 w-4" /> Download Certificate
              </a>
            ) : (
              <Link
                to="/payment"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                data-testid="status-complete-payment-btn"
              >
                Complete Payment <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
            <Info label="Name" value={reg.full_name} />
            <Info label="Email" value={reg.email} />
            <Info label="Internship" value={reg.internship_type} />
            <Info label="Certificate" value={reg.certificate_type} />
            <Info label="Duration" value={formatDuration(reg.duration_months)} />
            <Info label="Certificate Status" value={reg.certificate_status} />
            <Info label="Registered On" value={reg.created_at?.slice(0, 10)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 py-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900 text-right">{value || "—"}</span>
    </div>
  );
}
