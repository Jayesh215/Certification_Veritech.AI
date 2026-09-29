import { useEffect, useState } from "react";
import { TrendingUp, Users, CheckCircle2, Clock, XCircle, Award } from "lucide-react";
import { api, formatCurrency } from "../lib/api";

const KPI = ({ icon: Icon, label, value, tone = "slate", testid }) => {
  const toneMap = {
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow transition-shadow" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900 font-mono-tabular">{value}</p>
    </div>
  );
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/admin/dashboard").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-slate-500">Live snapshot of registrations, payments, and certificate issuance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPI icon={Users} label="Total Registrations" value={stats?.total_registrations ?? "—"} tone="slate" testid="kpi-total-registrations" />
        <KPI icon={CheckCircle2} label="Paid" value={stats?.paid ?? "—"} tone="green" testid="kpi-paid" />
        <KPI icon={Clock} label="Pending" value={stats?.pending ?? "—"} tone="amber" testid="kpi-pending" />
        <KPI icon={XCircle} label="Failed" value={stats?.failed ?? "—"} tone="red" testid="kpi-failed" />
        <KPI icon={TrendingUp} label="Revenue" value={stats ? formatCurrency(stats.revenue) : "—"} tone="blue" testid="admin-kpi-total-revenue" />
        <KPI icon={Award} label="Certificates" value={stats?.certificates_generated ?? "—"} tone="slate" testid="kpi-certificates" />
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">Quick actions</h2>
        <p className="mt-1 text-sm text-slate-500">Manage registrations, verify payments, and issue certificates.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <a href="/admin/registrations" className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800">Manage Registrations</a>
          <a href="/admin/payments" className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-800 hover:border-slate-300">View Payments</a>
          <a href="/admin/certificates" className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-800 hover:border-slate-300">Certificate Manager</a>
        </div>
      </div>
    </div>
  );
}
