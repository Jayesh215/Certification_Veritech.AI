import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon, Loader2, CheckCircle2 } from "lucide-react";
import { api, API_BASE } from "../lib/api";

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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

export default function AdminBranding() {
  const [state, setState] = useState({ signature: {}, seal: {} });
  const load = () => api.get("/admin/branding").then((r) => setState(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Certificate Branding</h1>
        <p className="mt-1 text-sm text-slate-500 max-w-2xl">
          Upload an authorized signature and an official seal. They will be printed on every certificate — including previews and downloads.
          Use PNGs with transparent backgrounds for the cleanest result.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BrandingCard
          kind="signature"
          label="Authorized Signature"
          description="Appears above the “Authorized Signatory” line at the bottom right of every certificate."
          aspect="h-40"
          state={state.signature}
          onChange={load}
        />
        <BrandingCard
          kind="seal"
          label="Official Seal"
          description="Printed near the bottom-centre of every certificate for extra credibility."
          aspect="h-48"
          state={state.seal}
          onChange={load}
        />
      </div>
    </div>
  );
}
