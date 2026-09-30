import { useEffect, useState } from "react";
import { Search, Download, FileDown } from "lucide-react";
import { api, API_BASE, formatCurrency, formatDurationShort } from "../lib/api";

async function downloadCsv(path, filename) {
  const token = localStorage.getItem("veritech_admin_token");
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const StatusBadge = ({ s }) => {
  const map = {
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    FAILED: "bg-red-50 text-red-700 border-red-200",
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${map[s] || map.PENDING}`}>{s}</span>;
};

export default function AdminRegistrations() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [duration, setDuration] = useState("");

  const load = async () => {
    const params = {};
    if (search) params.search = search;
    if (status) params.payment_status = status;
    if (duration) params.duration = duration;
    const { data } = await api.get("/admin/registrations", { params });
    setRows(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, duration]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Registrations</h1>
          <p className="mt-1 text-sm text-slate-500">All intern registrations and their statuses.</p>
        </div>
        <button
          onClick={() => downloadCsv("/admin/registrations/export", "veritech-registrations.csv")}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          data-testid="export-registrations-csv"
        >
          <FileDown className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search by name, email, ID or mobile"
            className="flex-1 bg-transparent text-sm outline-none"
            data-testid="admin-registrations-search"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" data-testid="filter-payment-status">
          <option value="">All statuses</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>
        <select value={duration} onChange={(e) => setDuration(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" data-testid="filter-duration">
          <option value="">All durations</option>
          <option value="0">1 Day</option>
          <option value="1">1 Month</option>
          <option value="2">2 Months</option>
          <option value="3">3 Months</option>
          <option value="6">6 Months</option>
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Reg. ID</th>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Email</th>
                <th className="text-left px-4 py-3 font-semibold">Internship</th>
                <th className="text-left px-4 py-3 font-semibold">Duration</th>
                <th className="text-left px-4 py-3 font-semibold">Amount</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.registration_id} className="border-b border-slate-100 hover:bg-slate-50/60" data-testid={`row-${r.registration_id}`}>
                  <td className="px-4 py-3 font-mono-tabular text-xs font-semibold">{r.registration_id}</td>
                  <td className="px-4 py-3">{r.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.email}</td>
                  <td className="px-4 py-3 text-slate-600">{r.internship_type}</td>
                  <td className="px-4 py-3">{formatDurationShort(r.duration_months)}</td>
                  <td className="px-4 py-3 font-mono-tabular">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3"><StatusBadge s={r.payment_status} /></td>
                  <td className="px-4 py-3">
                    {r.payment_status === "PAID" && (
                      <a
                        href={`${API_BASE}/receipts/${r.registration_id}/download`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      ><Download className="h-3 w-3" /> Receipt</a>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-slate-500">No registrations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
