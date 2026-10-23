import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Award, Download, Eye, FileDown, MoreVertical, X, Loader2, Search } from "lucide-react";
import { api, API_BASE, datesFor, durationWithDates, formatDuration } from "../lib/api";
import useInternshipPeriods from "../lib/useInternshipPeriods";
import usePagination from "../lib/usePagination";
import useRowSelection from "../lib/useRowSelection";
import { TableSkeleton } from "../components/PageSkeletons";
import ListPagination from "../components/ListPagination";
import ListBulkBar from "../components/ListBulkBar";
import ClearDataModal from "../components/ClearDataModal";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const getCertRowId = (r) => r.registration_id;

const StatusBadge = ({ s }) => {
  const map = {
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Generated: "bg-blue-50 text-blue-700 border-blue-200",
    Issued: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${map[s] || map.Pending}`}>{s || "Pending"}</span>;
};

export default function AdminCertificates() {
  const periods = useInternshipPeriods();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewFor, setPreviewFor] = useState(null); // { registration_id, full_name }
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [certStatus, setCertStatus] = useState("");
  const [duration, setDuration] = useState("");
  const [internshipType, setInternshipType] = useState("");
  const [busy, setBusy] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/registrations", { params: { payment_status: "PAID" } });
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const internshipOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.internship_type).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (certStatus && (r.certificate_status || "Pending") !== certStatus) return false;
      if (duration !== "" && Number(r.duration_months) !== Number(duration)) return false;
      if (internshipType && r.internship_type !== internshipType) return false;
      if (!q) return true;
      const hay = [
        r.registration_id,
        r.full_name,
        r.email,
        r.internship_type,
        r.certificate_number,
        r.certificate_status,
        formatDuration(r.duration_months),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, certStatus, duration, internshipType]);

  const pagination = usePagination(filtered, {
    resetKey: `${search}|${certStatus}|${duration}|${internshipType}`,
  });
  const selection = useRowSelection(pagination.pageItems, getCertRowId);

  const handleBulkDelete = async () => {
    if (selection.selectedCount === 0) return;
    setBusy(true);
    try {
      const { data } = await api.post("/admin/certificates/bulk-delete", {
        registration_ids: selection.selectedIds,
      });
      const n = data?.deleted?.registrations ?? selection.selectedCount;
      toast.success(`Deleted ${n} record(s) from the database`);
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
      const { data } = await api.post("/admin/certificates/clear", { confirm: "DELETE" });
      const n = data?.deleted?.registrations ?? 0;
      toast.success(`Cleared ${n} paid registration(s) and related payments`);
      setClearOpen(false);
      selection.clearSelection();
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Clear all failed");
    } finally {
      setBusy(false);
    }
  };

  async function generate(id) {
    try {
      await api.post(`/admin/certificates/${id}/generate`);
      toast.success("Certificate generated");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not generate");
    }
  }

  async function openPreview(row) {
    setPreviewFor(row);
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const token = localStorage.getItem("veritech_admin_token");
      const res = await fetch(`${API_BASE}/admin/certificates/${row.registration_id}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("preview failed");
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      toast.error("Could not load preview");
      setPreviewFor(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFor(null);
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Certificates</h1>
        <p className="mt-1 text-sm text-slate-500">Preview, generate, and dispatch certificates for paid registrations.</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reg ID, name, email, certificate no…"
            className="flex-1 bg-transparent text-sm outline-none"
            data-testid="certificates-search-input"
          />
        </div>
        <select
          value={certStatus}
          onChange={(e) => setCertStatus(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          data-testid="certificates-status-filter"
        >
          <option value="">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Generated">Generated</option>
          <option value="Issued">Issued</option>
        </select>
        <select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          data-testid="certificates-duration-filter"
        >
          <option value="">All durations</option>
          {[0, 1, 2, 3, 6].map((months) => (
            <option key={months} value={months}>
              {formatDuration(months)}
            </option>
          ))}
        </select>
        <select
          value={internshipType}
          onChange={(e) => setInternshipType(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          data-testid="certificates-internship-filter"
        >
          <option value="">All internships</option>
          {internshipOptions.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        {(search || certStatus || duration !== "" || internshipType) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCertStatus("");
              setDuration("");
              setInternshipType("");
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            data-testid="certificates-clear-filters"
          >
            Clear
          </button>
        )}
        <ListBulkBar
          selectedCount={selection.selectedCount}
          busy={busy}
          onBulkDelete={() => setDeleteOpen(true)}
          onClearAll={() => setClearOpen(true)}
          testId="certificates-bulk"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={8} />
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
                    data-testid="certificates-select-page"
                    aria-label="Select page"
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold">Reg. ID</th>
                <th className="text-left px-4 py-3 font-semibold">Intern</th>
                <th className="text-left px-4 py-3 font-semibold">Internship</th>
                <th className="text-left px-4 py-3 font-semibold">Duration</th>
                <th className="text-left px-4 py-3 font-semibold">Certificate No.</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((r) => (
                <tr key={r.registration_id} className="border-b border-slate-100 hover:bg-slate-50/60">
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
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{r.full_name}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.internship_type}</td>
                  <td className="px-4 py-3">{durationWithDates(r.duration_months, datesFor(periods, r.duration_months, r).start, datesFor(periods, r.duration_months, r).end)}</td>
                  <td className="px-4 py-3 font-mono-tabular text-xs">{r.certificate_number || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge s={r.certificate_status} /></td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          aria-label="Certificate actions"
                          data-testid={`cert-actions-${r.registration_id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onSelect={() => openPreview(r)}
                          data-testid={`preview-cert-${r.registration_id}`}
                        >
                          <Eye className="h-4 w-4" /> Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={`${API_BASE}/certificates/${r.registration_id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`download-cert-${r.registration_id}`}
                          >
                            <Download className="h-4 w-4" /> Download
                          </a>
                        </DropdownMenuItem>
                        {r.certificate_status === "Pending" ? (
                          <DropdownMenuItem
                            onSelect={() => generate(r.registration_id)}
                            data-testid={`generate-cert-${r.registration_id}`}
                          >
                            <Award className="h-4 w-4" /> Generate
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-sm text-slate-500">
                    {rows.length === 0 ? "No paid registrations yet" : "No certificates match your search or filters"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ListPagination
          {...pagination}
          onPageSizeChange={pagination.setPageSize}
          label="certificates"
          testId="certificates-pagination"
        />
      </div>
      )}

      <ConfirmDeleteModal
        open={deleteOpen}
        title="Delete selected certificates?"
        description={`Permanently delete ${selection.selectedCount} certificate registration(s) and related payments from the database? This cannot be undone.`}
        confirmLabel="Delete selected"
        count={selection.selectedCount}
        busy={busy}
        onClose={() => !busy && setDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        testId="certificates-delete-modal"
      />

      <ClearDataModal
        open={clearOpen}
        title="Clear all certificates"
        description="This permanently deletes every paid registration (and related payments) shown on this page from the database to free storage."
        confirmLabel="Clear all data"
        busy={busy}
        onClose={() => !busy && setClearOpen(false)}
        onConfirm={handleClearAll}
        testId="certificates-clear-modal"
      />

      {previewFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-testid="cert-preview-modal">
          <div className="w-full max-w-5xl h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Certificate Preview</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {previewFor.full_name} · <span className="font-mono-tabular">{previewFor.registration_id}</span>
                  {previewFor.certificate_status === "Pending" && (
                    <span className="ml-2 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-bold border border-amber-200">
                      Not yet generated
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${API_BASE}/certificates/${previewFor.registration_id}/download`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  data-testid="cert-preview-download-btn"
                ><FileDown className="h-3.5 w-3.5" /> Download</a>
                <button
                  onClick={closePreview}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300"
                  data-testid="cert-preview-close-btn"
                ><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex-1 bg-slate-50 relative">
              {previewLoading ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Rendering preview…
                </div>
              ) : previewUrl ? (
                <iframe src={previewUrl} title="Certificate preview" className="w-full h-full" data-testid="cert-preview-iframe" />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
