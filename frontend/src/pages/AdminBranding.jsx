import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon, Loader2, CheckCircle2, Plus } from "lucide-react";
import { api, API_BASE } from "../lib/api";
import { BrandingSkeleton } from "../components/PageSkeletons";

function BrandingCard({ kind, label, description, aspect, state, onChange }) {
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0); // cache-bust the preview image

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    try {
      const token = localStorage.getItem("veritech_admin_token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/admin/branding/${kind}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "upload failed");
      toast.success(`${label} uploaded`);
      setNonce((n) => n + 1);
      onChange();
    } catch (e) {
      toast.error(e.message || "Could not upload");
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/admin/branding/${kind}`);
      toast.success(`${label} removed`);
      onChange();
    } catch { toast.error("Could not remove"); }
    finally { setBusy(false); }
  }

  const previewSrc = state?.present
    ? `${API_BASE}/admin/branding/${kind}/image?v=${nonce}&t=${state.updated_at || ""}`
    : null;
  const token = localStorage.getItem("veritech_admin_token");

  return (
    <div className="rounded-[28px] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{label}</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-xs">{description}</p>
        </div>
        {state?.present && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3" /> Active
          </span>
        )}
      </div>

      <div
        className={`mt-5 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 ${aspect}`}
        data-testid={`${kind}-preview-box`}
      >
        {previewSrc ? (
          <AuthImage src={previewSrc} token={token} alt={label} />
        ) : (
          <div className="text-center text-slate-400">
            <ImageIcon className="mx-auto h-8 w-8" />
            <p className="mt-2 text-xs">No {label.toLowerCase()} uploaded</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {state?.present ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
            data-testid={`${kind}-upload-input`}
          />
        </label>
        {state?.present && (
          <button
            onClick={remove}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-red-200 hover:text-red-600"
            data-testid={`${kind}-remove-btn`}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        )}
        <span className="text-xs text-slate-400">PNG, JPG or WEBP · up to 2 MB</span>
      </div>
    </div>
  );
}

// Renders an image behind admin auth via blob URL
function AuthImage({ src, token, alt }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let revoked = null;
    fetch(src, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => {
        const u = URL.createObjectURL(b);
        revoked = u;
        setUrl(u);
      })
      .catch(() => setUrl(null));
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [src, token]);
  if (!url) return <Loader2 className="h-5 w-5 animate-spin text-slate-400" />;
  return <img src={url} alt={alt} className="max-h-full max-w-full object-contain" data-testid="branding-preview-img" />;
}

const PERIODS = [
  { months: "1", label: "1 Month" },
  { months: "2", label: "2 Months" },
  { months: "3", label: "3 Months" },
  { months: "6", label: "6 Months" },
];

const emptyPeriods = () => Object.fromEntries(PERIODS.map(({ months }) => [months, { start_date: "", end_date: "" }]));

export default function AdminBranding() {
  const [state, setState] = useState({ logo: {}, signature: {}, seal: {}, periods: emptyPeriods(), domains: [] });
  const [periods, setPeriods] = useState(emptyPeriods());
  const [domains, setDomains] = useState([]);
  const [domainDraft, setDomainDraft] = useState("");
  const [savingDates, setSavingDates] = useState(false);
  const [savingDomains, setSavingDomains] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    return api.get("/admin/branding").then((r) => {
      setState(r.data);
      setPeriods({ ...emptyPeriods(), ...(r.data.periods || {}) });
      setDomains(Array.isArray(r.data.domains) ? r.data.domains : []);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  function setPeriod(months, field, value) {
    setPeriods((current) => ({
      ...current,
      [months]: { ...current[months], [field]: value },
    }));
  }

  async function savePeriods(e) {
    e.preventDefault();
    setSavingDates(true);
    try {
      const { data } = await api.put("/admin/branding/periods", { periods });
      setPeriods({ ...emptyPeriods(), ...(data.periods || {}) });
      toast.success("Internship dates saved");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not save dates");
    } finally {
      setSavingDates(false);
    }
  }

  function addDomain() {
    const name = domainDraft.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (domains.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      toast.error("That domain is already in the list");
      return;
    }
    setDomains((current) => [...current, { name, active: true }]);
    setDomainDraft("");
  }

  async function saveDomains(e) {
    e.preventDefault();
    setSavingDomains(true);
    try {
      const { data } = await api.put("/admin/branding/domains", { domains });
      setDomains(data.domains || []);
      toast.success("Internship domains saved");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not save domains");
    } finally {
      setSavingDomains(false);
    }
  }

  if (loading) {
    return <BrandingSkeleton />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Certificate branding</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Add the company logo, authorized signature, and official seal. They print on every internship completion certificate.
          Transparent PNGs look cleanest.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BrandingCard
          kind="logo"
          label="Company Logo"
          description="Printed at the top left of every internship completion certificate."
          aspect="h-40"
          state={state.logo}
          onChange={load}
        />
        <BrandingCard
          kind="signature"
          label="Authorized Signature"
          description="Printed above the Program Director line on the lower left."
          aspect="h-40"
          state={state.signature}
          onChange={load}
        />
        <BrandingCard
          kind="seal"
          label="Official Seal"
          description="Printed on the lower right of every certificate."
          aspect="h-40"
          state={state.seal}
          onChange={load}
        />
      </div>

      <form onSubmit={saveDomains} className="mt-4 rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Internship domains</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Select the domains offered on the internship certificate. Selected domains appear in the registration form dropdown.
        </p>
        <ul className="mt-5 space-y-2">
          {domains.map((item) => (
            <li key={item.name} className="flex items-center gap-3 rounded-2xl bg-[#f6f7fb] px-4 py-3">
              <input
                type="checkbox"
                checked={item.active}
                onChange={(e) => setDomains((current) => current.map((row) => (
                  row.name === item.name ? { ...row, active: e.target.checked } : row
                )))}
                className="h-4 w-4 accent-blue-600"
                data-testid={`domain-active-${item.name}`}
              />
              <span className={`flex-1 text-sm font-medium ${item.active ? "text-slate-900" : "text-slate-400"}`}>{item.name}</span>
              <button
                type="button"
                onClick={() => setDomains((current) => current.filter((row) => row.name !== item.name))}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-600"
                data-testid={`domain-remove-${item.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={domainDraft}
            onChange={(e) => setDomainDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDomain();
              }
            }}
            placeholder="Add a domain, for example Cloud Computing"
            className="flex-1 rounded-2xl bg-[#f6f7fb] px-4 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="domain-draft-input"
          />
          <button
            type="button"
            onClick={addDomain}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            data-testid="domain-add-btn"
          >
            <Plus className="h-4 w-4" /> Add domain
          </button>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={savingDomains}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="domains-save-btn"
          >
            {savingDomains ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save domains
          </button>
        </div>
      </form>

      <form onSubmit={savePeriods} className="mt-4 rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Internship dates</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Set the start and end date printed on the internship completion certificate for each duration.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {PERIODS.map(({ months, label }) => (
            <div key={months} className="rounded-[20px] bg-[#f6f7fb] p-4">
              <p className="text-sm font-semibold text-slate-900">{label}</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Start date
                  <input
                    type="date"
                    value={periods[months]?.start_date || ""}
                    onChange={(e) => setPeriod(months, "start_date", e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-transparent bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none focus:border-blue-500"
                    data-testid={`period-start-${months}`}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  End date
                  <input
                    type="date"
                    value={periods[months]?.end_date || ""}
                    onChange={(e) => setPeriod(months, "end_date", e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-transparent bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none focus:border-blue-500"
                    data-testid={`period-end-${months}`}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={savingDates}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="periods-save-btn"
          >
            {savingDates ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save dates
          </button>
        </div>
      </form>
    </div>
  );
}
