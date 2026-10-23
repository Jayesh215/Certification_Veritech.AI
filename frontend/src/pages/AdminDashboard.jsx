import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { api, formatCurrency, formatDateRange, formatDuration } from "../lib/api";
import FailureAnalytics from "../components/FailureAnalytics";
import { DashboardSkeleton } from "../components/PageSkeletons";
import DatePillPicker from "../components/DatePillPicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const DATE_PRESETS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom dates" },
];

function isoToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Resolve date-range preset → { from, to } (YYYY-MM-DD or empty). */
function resolveDateRange(preset, customFrom, customTo) {
  if (preset === "today") return { from: isoToday(), to: isoToday() };
  if (preset === "7d") return { from: isoDaysAgo(6), to: isoToday() };
  if (preset === "30d") return { from: isoDaysAgo(29), to: isoToday() };
  if (preset === "custom") return { from: customFrom || "", to: customTo || "" };
  return { from: "", to: "" };
}

const STATUS_COLOR = {
  PAID: "#2563EB",
  PENDING: "#D9DEE8",
  FAILED: "#F43F5E",
  REFUNDED: "#94A3B8",
  PARTIALLY_REFUNDED: "#93C5FD",
};

const EMPTY = {
  total_registrations: 0,
  paid: 0,
  pending: 0,
  failed: 0,
  refunded: 0,
  revenue: 0,
  certificates_generated: 0,
  today_received: 0,
  today_registrations: 0,
  week_total: 0,
  revenue_change_pct: 0,
  months: [],
  days: [],
  durations: [],
  internships: [],
  statuses: [],
  recent: [],
  generated_at: null,
};

function ago(iso, now) {
  if (!iso) return "waiting";
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 8) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function MoneyTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-slate-300">Revenue {formatCurrency(row.revenue)}</p>
      <p className="text-slate-300">{row.registrations} registration{row.registrations === 1 ? "" : "s"}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [datePreset, setDatePreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dateRange = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  useEffect(() => {
    let alive = true;
    // For custom range, wait until at least one date is set before querying.
    if (datePreset === "custom" && !dateRange.from && !dateRange.to) {
      return undefined;
    }
    const load = async (manual = false) => {
      if (manual) setRefreshing(true);
      try {
        const params = {};
        if (dateRange.from) params.date_from = dateRange.from;
        if (dateRange.to) params.date_to = dateRange.to;
        const { data } = await api.get("/admin/dashboard", { params });
        if (alive) setStats(data);
      } catch {
        if (alive) setStats((current) => current);
      } finally {
        if (alive) {
          setLoading(false);
          if (manual) setRefreshing(false);
        }
      }
    };
    load();
    // Poll less often so many admins / users don't overload the API.
    const poll = setInterval(() => load(false), 30000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [datePreset, dateRange.from, dateRange.to]);

  const data = stats || EMPTY;
  const paidShare = useMemo(() => {
    if (!data.total_registrations) return 0;
    return Math.round((data.paid / data.total_registrations) * 100);
  }, [data.paid, data.total_registrations]);

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  const maxDay = Math.max(1, ...data.days.map((day) => day.count));
  const statusTotal = data.statuses.reduce((sum, item) => sum + item.count, 0);
  const pieData = statusTotal
    ? data.statuses.map((item) => ({ name: item.label, value: item.count, key: item.key }))
    : [{ name: "No data", value: 1, key: "EMPTY" }];
  const hasRevenue = data.months.some((month) => month.revenue > 0);
  const certRate = data.paid
    ? Math.round((data.certificates_generated / data.paid) * 100)
    : 0;
  const pendingCerts = Math.max(0, data.paid - data.certificates_generated);

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Certificate Report Overview</h1>
            <p className="mt-1 text-xs text-slate-400">Last update, {ago(data.generated_at, now)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={datePreset}
              onValueChange={(next) => {
                setDatePreset(next);
                if (next === "custom" && !customFrom && !customTo) {
                  setCustomFrom(isoDaysAgo(6));
                  setCustomTo(isoToday());
                }
              }}
            >
              <SelectTrigger
                className="vt-filter-pill h-8 w-auto min-w-[8.5rem] gap-1.5 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500/20 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60"
                data-testid="dashboard-date-preset"
                aria-label="Filter by date range"
              >
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent
                align="end"
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-lg"
              >
                {DATE_PRESETS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className={
                      datePreset === opt.value
                        ? "cursor-pointer rounded-xl py-2 pl-3 pr-8 text-xs font-semibold bg-blue-600 text-white focus:bg-blue-600 focus:text-white data-[highlighted]:bg-blue-600 data-[highlighted]:text-white"
                        : "cursor-pointer rounded-xl py-2 pl-3 pr-8 text-xs font-semibold text-slate-700 focus:bg-blue-50 focus:text-blue-700 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700"
                    }
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {datePreset === "custom" && (
              <>
                <DatePillPicker
                  value={customFrom}
                  onChange={setCustomFrom}
                  max={customTo || undefined}
                  placeholder="From"
                  testId="dashboard-date-from"
                />
                <span className="text-[11px] font-semibold text-slate-400">to</span>
                <DatePillPicker
                  value={customTo}
                  onChange={setCustomTo}
                  min={customFrom || undefined}
                  placeholder="To"
                  testId="dashboard-date-to"
                />
              </>
            )}
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
            <button
              onClick={() => {
                setRefreshing(true);
                const params = {};
                if (dateRange.from) params.date_from = dateRange.from;
                if (dateRange.to) params.date_to = dateRange.to;
                api.get("/admin/dashboard", { params }).then((r) => setStats(r.data)).finally(() => setRefreshing(false));
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          <article className="rounded-[24px] bg-[#f6f7fb] p-5" data-testid="admin-kpi-total-revenue">
            <p className="text-sm text-slate-500">Collected revenue</p>
            <div className="mt-3 flex items-end gap-2">
              <p className="text-4xl font-semibold tracking-tight text-slate-900" data-testid="kpi-paid">{formatCurrency(data.revenue)}</p>
              <span className={`mb-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${data.revenue_change_pct >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                {data.revenue_change_pct >= 0 ? "+" : ""}{data.revenue_change_pct}%
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">Paid registrations this period versus last month</p>
            <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
              <span data-testid="kpi-total-registrations">{data.total_registrations} registrations</span>
              <span data-testid="kpi-certificates">{data.certificates_generated} certificates</span>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[24px] bg-[#1c2430] p-5 text-white">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">₹</span>
                Today received
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5">{data.today_registrations} new</span>
            </div>
            <p className="mt-6 text-3xl font-semibold tracking-tight">{formatCurrency(data.today_received)}</p>
            <p className="mt-2 text-xs text-emerald-300">{paidShare}% of all registrations are paid</p>
          </article>

          <article className="rounded-[24px] bg-[#f6f7fb] p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">This week</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{data.week_total}</p>
                <p className="mt-1 text-xs text-slate-400">Registrations in the last 7 days</p>
              </div>
            </div>
            <div className="mt-5 flex h-16 items-end gap-1.5">
              {data.days.map((day) => (
                <div key={day.label + day.count} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-full bg-blue-500"
                    style={{ height: `${Math.max(8, (day.count / maxDay) * 64)}px`, opacity: day.count ? 1 : 0.25 }}
                    title={`${day.label}: ${day.count}`}
                  />
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] bg-[#f6f7fb] p-5" data-testid="admin-kpi-certificates">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Certificates issued</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {data.certificates_generated}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {pendingCerts > 0
                    ? `${pendingCerts} paid still pending`
                    : data.paid
                      ? "All paid registrations covered"
                      : "No paid registrations yet"}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                {certRate}%
              </span>
            </div>
            <div className="mt-5">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, certRate)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                <span>{data.certificates_generated} issued</span>
                <span>{data.paid} paid</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <article className="rounded-[28px] bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Payment mix</h2>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">{paidShare}% paid</span>
          </div>
          <div className="mt-2 grid grid-cols-2 items-center gap-2">
            <div className="relative h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={statusTotal ? 3 : 0} stroke="none">
                    {pieData.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLOR[entry.key] || "#E2E8F0"} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-semibold text-slate-900">{data.total_registrations}</p>
                <p className="text-[11px] text-slate-400">Total</p>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm">
              {data.statuses.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-2" data-testid={item.key === "PENDING" ? "kpi-pending" : item.key === "FAILED" ? "kpi-failed" : undefined}>
                  <span className="inline-flex items-center gap-2 text-slate-500">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[item.key] || "#E2E8F0" }} />
                    {item.label}
                  </span>
                  <span className="font-semibold text-slate-900">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="rounded-[28px] bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Monthly collections</h2>
              <p className="mt-1 text-xs text-slate-400">{hasRevenue ? "Paid amount by month" : "Registration volume by month"}</p>
            </div>
            <Link to="/admin/payments" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.months} barSize={18}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis hide />
                <Tooltip content={<MoneyTip />} cursor={{ fill: "rgba(37,99,235,0.08)" }} />
                <Bar dataKey={hasRevenue ? "revenue" : "registrations"} radius={[8, 8, 8, 8]} fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-[28px] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Duration mix</h2>
          <p className="mt-1 text-xs text-slate-400">How interns choose a certificate length</p>
          <ul className="mt-4 space-y-3">
            {data.durations.map((item) => {
              const max = Math.max(1, ...data.durations.map((row) => row.count));
              return (
                <li key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {item.label}
                      {formatDateRange(item.start_date, item.end_date) && (
                        <span className="block text-[11px] font-medium text-slate-400">{formatDateRange(item.start_date, item.end_date)}</span>
                      )}
                    </span>
                    <span className="font-semibold text-slate-900">{item.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${(item.count / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="rounded-[28px] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Latest registrations</h2>
            <Link to="/admin/registrations" className="text-xs font-semibold text-blue-600">Open</Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {data.recent.length === 0 && <li className="py-6 text-sm text-slate-400">Registrations will appear here as they are created.</li>}
            {data.recent.map((row) => (
              <li key={row.registration_id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.full_name}</p>
                  <p className="truncate text-[11px] text-slate-400">{row.registration_id} · {formatDuration(row.duration_months)}{formatDateRange(row.internship_start_date, row.internship_end_date) ? ` · ${formatDateRange(row.internship_start_date, row.internship_end_date)}` : ""} · {row.internship_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(row.amount)}</p>
                  <p className="text-[11px] text-slate-400">{row.payment_status}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <FailureAnalytics />
      </section>
    </div>
  );
}
