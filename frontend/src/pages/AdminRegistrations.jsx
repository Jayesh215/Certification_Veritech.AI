import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Search, FileDown, Loader2, Mail } from "lucide-react";
import { api, API_BASE, datesFor, durationWithDates, formatCurrency } from "../lib/api";
import useInternshipPeriods from "../lib/useInternshipPeriods";
import usePagination from "../lib/usePagination";
import useRowSelection from "../lib/useRowSelection";
import { TableSkeleton } from "../components/PageSkeletons";
import ListPagination from "../components/ListPagination";
import ListBulkBar from "../components/ListBulkBar";
import ClearDataModal from "../components/ClearDataModal";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";

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

const getRowId = (r) => r.registration_id;

export default function AdminRegistrations() {
  const periods = useInternshipPeriods();
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(q);
  const [appliedSearch, setAppliedSearch] = useState(q);
  const [status, setStatus] = useState("");
  const [duration, setDuration] = useState("");
  const [busy, setBusy] = useState(false);
  const [mailingId, setMailingId] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = async (term = search) => {
    setLoading(true);
    try {
      const query = {};
      if (term) query.search = term;
      if (status) query.payment_status = status;
      if (duration) query.duration = duration;
      const { data } = await api.get("/admin/registrations", { params: query });
      setRows(Array.isArray(data) ? data : []);
      setAppliedSearch(term || "");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setSearch(q);
    load(q);
    /* eslint-disable-next-line */
  }, [status, duration, q]);

  const pagination = usePagination(rows, {
    resetKey: `${appliedSearch}|${status}|${duration}`,
  });
  const selection = useRowSelection(pagination.pageItems, getRowId);

  const handleBulkDelete = async () => {
    if (selection.selectedCount === 0) return;
    setBusy(true);
    try {
      const { data } = await api.post("/admin/registrations/bulk-delete", {
        registration_ids: selection.selectedIds,
      });
      const n = data?.deleted?.registrations ?? selection.selectedCount;
      toast.success(`Deleted ${n} registration(s) from the database`);
      setDeleteOpen(false);
      selection.clearSelection();
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk delete failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/registrations/clear", { confirm: "DELETE" });
      const n = data?.deleted?.registrations ?? 0;
      toast.success(`Cleared ${n} registration(s) and related payments`);
      setClearOpen(false);
      selection.clearSelection();
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Clear all failed");
    } finally {
      setBusy(false);
    }
  };

  const sendReminder = async (row) => {
    const id = row?.registration_id;
    if (!id || mailingId) return;
    setMailingId(id);
    const path = `/admin/registrations/${encodeURIComponent(id)}/send-reminder`;
    // #region agent log
    fetch('http://127.0.0.1:7516/ingest/c28c4a9d-ffaa-4193-982c-356d4f7ca568',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'788dd8'},body:JSON.stringify({sessionId:'788dd8',runId:'post-fix',hypothesisId:'A',location:'AdminRegistrations.jsx:sendReminder',message:'reminder request start',data:{path,apiBase:API_BASE,status:row?.payment_status||null,hasId:Boolean(id)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      const { data } = await api.post(path);
      // #region agent log
      fetch('http://127.0.0.1:7516/ingest/c28c4a9d-ffaa-4193-982c-356d4f7ca568',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'788dd8'},body:JSON.stringify({sessionId:'788dd8',runId:'post-fix',hypothesisId:'A',location:'AdminRegistrations.jsx:sendReminder',message:'reminder request success',data:{path,ok:Boolean(data?.ok),hasEmailId:Boolean(data?.email_id)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.success(`Reminder sent to ${data?.to || row.email}`);
      await load();
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7516/ingest/c28c4a9d-ffaa-4193-982c-356d4f7ca568',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'788dd8'},body:JSON.stringify({sessionId:'788dd8',runId:'post-fix',hypothesisId:'A',location:'AdminRegistrations.jsx:sendReminder',message:'reminder request failed',data:{path,apiBase:API_BASE,httpStatus:e?.response?.status??null,detail:e?.response?.data?.detail??null,fullUrl:e?.config?`${e.config.baseURL||''}${e.config.url||''}`:null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.error(e?.response?.data?.detail || "Could not send reminder email");
    } finally {
      setMailingId("");
    }
  };

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
          {[1, 2, 3, 6].map((months) => {
            const slot = periods[String(months)] || {};
            const label = durationWithDates(months, slot.start_date, slot.end_date);
            return <option key={months} value={months}>{label}</option>;
          })}
        </select>
        <ListBulkBar
          selectedCount={selection.selectedCount}
          busy={busy}
          onBulkDelete={() => setDeleteOpen(true)}
          onClearAll={() => setClearOpen(true)}
          testId="registrations-bulk"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={9} />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="admin-data-table w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selection.allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = selection.somePageSelected && !selection.allPageSelected;
                      }}
                      onChange={selection.togglePage}
                      className="h-4 w-4 rounded border-slate-300"
                      data-testid="registrations-select-page"
                      aria-label="Select page"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold">Reg. ID</th>
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold">Email</th>
                  <th className="text-left px-4 py-3 font-semibold">Internship</th>
                  <th className="text-left px-4 py-3 font-semibold">Duration</th>
                  <th className="text-left px-4 py-3 font-semibold">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((r) => {
                  const canRemind = ["PENDING", "FAILED"].includes(String(r.payment_status || "").toUpperCase());
                  const sending = mailingId === r.registration_id;
                  return (
                  <tr key={r.registration_id} className="border-b border-slate-100 hover:bg-slate-50/60" data-testid={`row-${r.registration_id}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(r.registration_id)}
                        onChange={() => selection.toggle(r.registration_id)}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label={`Select ${r.registration_id}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-xs font-semibold">{r.registration_id}</td>
                    <td className="px-4 py-3">{r.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.email}</td>
                    <td className="px-4 py-3 text-slate-600">{r.internship_type}</td>
                    <td className="px-4 py-3">{durationWithDates(r.duration_months, datesFor(periods, r.duration_months, r).start, datesFor(periods, r.duration_months, r).end)}</td>
                    <td className="px-4 py-3 font-mono-tabular">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge s={r.payment_status} /></td>
                    <td className="px-4 py-3">
                      {canRemind ? (
                        <button
                          type="button"
                          onClick={() => sendReminder(r)}
                          disabled={Boolean(mailingId) || busy}
                          title={sending ? "Sending…" : "Send email"}
                          aria-label={sending ? "Sending reminder email" : "Send reminder email"}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          data-testid={`send-reminder-${r.registration_id}`}
                        >
                          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-16 text-center text-sm text-slate-500">No registrations found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <ListPagination
            {...pagination}
            onPageSizeChange={pagination.setPageSize}
            label="registrations"
            testId="registrations-pagination"
          />
        </div>
      )}

      <ConfirmDeleteModal
        open={deleteOpen}
        title="Delete selected registrations?"
        description={`Permanently delete ${selection.selectedCount} registration(s) and related payments from the database? This cannot be undone.`}
        confirmLabel="Delete selected"
        count={selection.selectedCount}
        busy={busy}
        onClose={() => !busy && setDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        testId="registrations-delete-modal"
      />

      <ClearDataModal
        open={clearOpen}
        title="Clear all registrations"
        description="This permanently deletes every registration, payment, and related audit log from the database to free storage."
        confirmLabel="Clear all data"
        busy={busy}
        onClose={() => !busy && setClearOpen(false)}
        onConfirm={handleClearAll}
        testId="registrations-clear-modal"
      />
    </div>
  );
}
