import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, FileDown, Upload, Loader2, Mail } from "lucide-react";
import { api, API_BASE } from "../lib/api";
import usePagination from "../lib/usePagination";
import useRowSelection from "../lib/useRowSelection";
import { TableSkeleton } from "../components/PageSkeletons";
import ListPagination from "../components/ListPagination";
import ListBulkBar from "../components/ListBulkBar";
import ClearDataModal from "../components/ClearDataModal";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";

const getInternId = (row) => row.intern_id;

const EDITABLE_FIELDS = [
  { key: "full_name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "mobile", label: "Mobile" },
  { key: "college", label: "College" },
  { key: "course", label: "Course" },
  { key: "branch", label: "Branch" },
  { key: "graduation_year", label: "Grad. Year" },
  { key: "internship_type", label: "Internship" },
];

async function downloadAuthenticated(path, filename) {
  const token = localStorage.getItem("veritech_admin_token");
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Download failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function EditableCell({
  value,
  field,
  internId,
  invalid,
  disabled,
  onSaved,
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const lastSaved = useRef(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
    lastSaved.current = value ?? "";
  }, [value, internId]);

  const save = async () => {
    const next = String(draft ?? "").trim();
    if (next === String(lastSaved.current ?? "").trim()) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/admin/interns/${encodeURIComponent(internId)}`, {
        [field]: next,
      });
      lastSaved.current = data?.[field] ?? next;
      setDraft(lastSaved.current);
      onSaved?.(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save");
      setDraft(lastSaved.current);
    } finally {
      setSaving(false);
    }
  };

  // Valid fields are read-only text; only incorrect fields are editable boxes.
  if (!invalid) {
    return (
      <td className="px-2.5 py-2 align-middle text-slate-700">
        <span className="block min-w-[5.5rem] text-xs leading-snug" data-testid={`intern-view-${internId}-${field}`}>
          {value || "—"}
        </span>
      </td>
    );
  }

  return (
    <td className="px-1.5 py-1 align-middle bg-red-50/80">
      <input
        value={draft}
        disabled={disabled || saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setDraft(lastSaved.current);
            e.currentTarget.blur();
          }
        }}
        title="Invalid — edit and press Enter or click away to save"
        className="w-full min-w-[5.5rem] rounded-none border border-red-400 bg-red-50 px-1.5 py-1 text-xs leading-snug text-red-900 outline-none ring-0 focus:border-red-500 focus:outline-none disabled:opacity-60"
        data-testid={`intern-edit-${internId}-${field}`}
      />
    </td>
  );
}

export default function AdminInterns() {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mailingId, setMailingId] = useState("");

  const load = async (term = search) => {
    setLoading(true);
    try {
      const params = {};
      if (term.trim()) params.search = term.trim();
      const { data } = await api.get("/admin/interns", { params });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not load interns");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.intern_id,
        r.full_name,
        r.email,
        r.mobile,
        r.college,
        r.course,
        r.branch,
        r.graduation_year,
        r.internship_type,
        ...(r.validation_errors || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const invalidCount = useMemo(
    () => rows.filter((r) => r.is_valid === false).length,
    [rows],
  );

  const pagination = usePagination(filtered, { resetKey: search });
  const selection = useRowSelection(pagination.pageItems, getInternId);

  const patchRow = (updated) => {
    if (!updated?.intern_id) return;
    setRows((prev) => prev.map((r) => (r.intern_id === updated.intern_id ? { ...r, ...updated } : r)));
  };

  const handleDownloadSample = async () => {
    try {
      await downloadAuthenticated("/admin/interns/template", "veritech-interns-template.csv");
      toast.success("Sample CSV downloaded");
    } catch (e) {
      toast.error(e?.message || "Could not download sample CSV");
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const name = String(file.name || "").toLowerCase();
    const allowed = [".csv", ".txt", ".tsv", ".xlsx", ".xlsm", ".xls", ".xltx", ".xltm"];
    if (!allowed.some((ext) => name.endsWith(ext))) {
      toast.error("Please choose a CSV or Excel file (.csv, .xlsx, .xls, …)");
      return;
    }
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("veritech_admin_token");
      const res = await fetch(`${API_BASE}/admin/interns/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.detail === "string" ? data.detail : "Import failed");
      }
      const parts = [
        `${data.imported || 0} imported`,
        `${data.updated || 0} updated`,
      ];
      if (data.invalid_count) parts.push(`${data.invalid_count} need fixes (shown in red)`);
      toast.success(`Import complete · ${parts.join(" · ")}`);
      selection.clearSelection();
      await load(search);
    } catch (e) {
      toast.error(e?.message || "Could not import file");
    } finally {
      setImporting(false);
    }
  };

  const sendInvite = async (row) => {
    const id = row?.intern_id;
    if (!id || mailingId) return;
    if (row.is_valid === false) {
      toast.error("Fix highlighted fields before sending the invite");
      return;
    }
    setMailingId(id);
    try {
      const { data } = await api.post(`/admin/interns/${encodeURIComponent(id)}/send-invite`);
      toast.success(`Invitation sent to ${data?.to || row.email}`);
      await load(search);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not send invitation email");
    } finally {
      setMailingId("");
    }
  };

  const handleBulkEmail = async () => {
    if (selection.selectedCount === 0 || busy) return;
    const selectedRows = rows.filter((r) => selection.selectedIds.includes(r.intern_id));
    const invalidSelected = selectedRows.filter((r) => r.is_valid === false).length;
    if (invalidSelected === selectedRows.length) {
      toast.error("Selected rows need fixes before email can be sent");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/admin/interns/bulk-send-invite", {
        intern_ids: selection.selectedIds,
      });
      const parts = [
        `${data.sent || 0} sent`,
        `${data.skipped || 0} skipped`,
        `${data.failed || 0} failed`,
      ];
      if ((data.sent || 0) > 0) {
        toast.success(`Bulk email · ${parts.join(" · ")}`);
      } else {
        toast.error(`No emails sent · ${parts.join(" · ")}`);
      }
      await load(search);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk email failed");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selection.selectedCount === 0) return;
    setBusy(true);
    try {
      const { data } = await api.post("/admin/interns/bulk-delete", {
        intern_ids: selection.selectedIds,
      });
      const n = data?.deleted?.interns ?? selection.selectedCount;
      toast.success(`Deleted ${n} intern(s)`);
      setDeleteOpen(false);
      selection.clearSelection();
      await load(search);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk delete failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/interns/clear", { confirm: "DELETE" });
      const n = data?.deleted?.interns ?? 0;
      toast.success(`Cleared ${n} intern(s) from the roster`);
      setClearOpen(false);
      selection.clearSelection();
      await load("");
      setSearch("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Clear all failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Interns</h1>
          <p className="mt-1 text-sm text-slate-500">
            Independent intern roster — import CSV or Excel with no row limit. Edit cells in the table to fix bad rows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSample}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            data-testid="interns-download-sample"
          >
            <FileDown className="h-4 w-4" /> Download sample CSV
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
            data-testid="interns-import-csv"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Importing…" : "Import file"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv,.xlsx,.xlsm,.xls,.xltx,.xltm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleImportFile}
            data-testid="interns-import-input"
          />
        </div>
      </div>

      {invalidCount > 0 && (
        <div
          className="mb-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          data-testid="interns-invalid-banner"
        >
          <p className="font-semibold">{invalidCount} row{invalidCount === 1 ? "" : "s"} need attention</p>
          <p className="mt-0.5 text-red-700/90">
            Incorrect fields are highlighted in red. Edit them directly in the table, then click away or press Enter to save.
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 min-w-[200px]">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, mobile, college…"
            className="flex-1 bg-transparent text-sm outline-none"
            data-testid="interns-search-input"
          />
        </div>
        <ListBulkBar
          selectedCount={selection.selectedCount}
          busy={busy}
          onBulkEmail={handleBulkEmail}
          emailLabel="Send / resend emails"
          onBulkDelete={() => setDeleteOpen(true)}
          onClearAll={() => setClearOpen(true)}
          testId="interns-bulk"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={12} />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="admin-data-table w-full text-xs leading-snug">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-2.5 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selection.allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = selection.somePageSelected && !selection.allPageSelected;
                      }}
                      onChange={selection.togglePage}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                      data-testid="interns-select-page"
                      aria-label="Select page"
                    />
                  </th>
                  <th className="text-left px-2.5 py-2 font-semibold">Intern ID</th>
                  {EDITABLE_FIELDS.map((f) => (
                    <th key={f.key} className="text-left px-2.5 py-2 font-semibold whitespace-nowrap">{f.label}</th>
                  ))}
                  <th className="text-left px-2.5 py-2 font-semibold">Imported</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Mails sent</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((r) => {
                  const sending = mailingId === r.intern_id;
                  const rowInvalid = r.is_valid === false;
                  const invalidFields = new Set(r.invalid_fields || []);
                  const mailCount = Number(r.invite_email_count || 0);
                  return (
                    <tr
                      key={r.intern_id}
                      className={`border-b border-slate-100 ${
                        rowInvalid ? "bg-red-50/70 hover:bg-red-50" : "hover:bg-slate-50/60"
                      }`}
                      title={rowInvalid ? (r.validation_errors || []).join(" · ") : undefined}
                      data-testid={`intern-row-${r.intern_id}`}
                    >
                      <td className="px-2.5 py-2">
                        <input
                          type="checkbox"
                          checked={selection.isSelected(r.intern_id)}
                          onChange={() => selection.toggle(r.intern_id)}
                          className="h-3.5 w-3.5 rounded border-slate-300"
                          aria-label={`Select ${r.intern_id}`}
                        />
                      </td>
                      <td className="px-2.5 py-2 font-mono-tabular text-[11px] font-semibold whitespace-nowrap">
                        {r.intern_id}
                        {rowInvalid && (
                          <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-red-600">
                            Needs fix
                          </span>
                        )}
                      </td>
                      {EDITABLE_FIELDS.map((f) => (
                        <EditableCell
                          key={`${r.intern_id}-${f.key}`}
                          internId={r.intern_id}
                          field={f.key}
                          value={r[f.key] || ""}
                          invalid={invalidFields.has(f.key)}
                          disabled={busy || importing}
                          onSaved={patchRow}
                        />
                      ))}
                      <td className="px-2.5 py-2 text-slate-500 text-[11px] whitespace-nowrap">
                        {(r.created_at || "").slice(0, 10) || "—"}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap" data-testid={`intern-mail-count-${r.intern_id}`}>
                        <span
                          className={`inline-flex min-w-[1.5rem] items-center justify-center px-1.5 py-0.5 text-[11px] font-semibold ${
                            mailCount > 0
                              ? "border border-blue-200 bg-blue-50 text-blue-700"
                              : "border border-slate-200 bg-slate-50 text-slate-500"
                          }`}
                          title={
                            mailCount > 0
                              ? `Invitation email sent ${mailCount} time${mailCount === 1 ? "" : "s"}`
                              : "No invitation email sent yet"
                          }
                        >
                          {mailCount}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => sendInvite(r)}
                          disabled={Boolean(mailingId) || busy || importing || rowInvalid}
                          title={
                            rowInvalid
                              ? "Fix invalid fields first"
                              : sending
                                ? "Sending…"
                                : mailCount > 0
                                  ? `Send again (already sent ${mailCount}×)`
                                  : "Send certificate claim invitation"
                          }
                          aria-label={sending ? "Sending invitation email" : "Send certificate claim invitation"}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-none border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          data-testid={`send-invite-${r.intern_id}`}
                        >
                          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-4 py-12 text-center text-xs text-slate-500">
                      {rows.length === 0
                        ? "No interns yet — download the sample CSV, then import your file"
                        : "No interns match your search"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <ListPagination
            {...pagination}
            onPageSizeChange={pagination.setPageSize}
            label="interns"
            testId="interns-pagination"
          />
        </div>
      )}

      <ConfirmDeleteModal
        open={deleteOpen}
        title="Delete selected interns?"
        description={`Permanently delete ${selection.selectedCount} intern(s) from the roster? This does not affect registrations or payments.`}
        confirmLabel="Delete selected"
        count={selection.selectedCount}
        busy={busy}
        onClose={() => !busy && setDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        testId="interns-delete-modal"
      />

      <ClearDataModal
        open={clearOpen}
        title="Clear all interns"
        description="This permanently deletes every intern in the roster. Registrations and payments are not affected."
        confirmLabel="Clear all data"
        busy={busy}
        onClose={() => !busy && setClearOpen(false)}
        onConfirm={handleClearAll}
        testId="interns-clear-modal"
      />
    </div>
  );
}
