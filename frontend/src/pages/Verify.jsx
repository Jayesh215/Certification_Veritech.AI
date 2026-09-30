import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import { Logo } from "../components/Logo";
import { api } from "../lib/api";

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900 text-right">{value || "—"}</span>
    </div>
  );
}

export default function Verify() {
  const { certNumber } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    api.get(`/verify/${certNumber}`)
      .then((r) => setState({ loading: false, data: r.data, error: null }))
      .catch((e) => setState({
        loading: false,
        data: null,
        error: e?.response?.data?.detail || "Certificate could not be verified",
      }));
  }, [certNumber]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900" data-testid="verify-back-link">
          <ArrowLeft className="h-4 w-4" /> Back to portal
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <Logo className="h-8" />
          <span className="h-6 w-px bg-slate-200" />
          <span className="text-sm font-semibold text-slate-700">Certificate Verification</span>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {state.loading ? (
            <div className="p-10 text-center text-slate-500 text-sm">Verifying…</div>
          ) : state.error ? (
            <>
              <div className="h-2 w-full bg-red-500" />
              <div className="p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 ring-4 ring-red-100">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Certificate not verified</h1>
                <p className="mt-2 text-sm text-slate-500">{state.error}</p>
                <p className="mt-4 text-xs text-slate-400 font-mono-tabular">Ref: {certNumber}</p>
              </div>
            </>
          ) : (
            <>
              <div className="h-2 w-full bg-emerald-500" />
              <div className="p-8 sm:p-10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100">
                      <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                    </div>
                    <div>
                      <h1 className="text-xl font-extrabold text-slate-900">Verified Certificate</h1>
                      <p className="text-xs text-slate-500 mt-0.5">Issued by Veritech.AI</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                    <ShieldCheck className="h-3 w-3" /> Authentic
                  </span>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 px-5">
                  <Row label="Certificate Number" value={<span className="font-mono-tabular">{state.data.certificate_number}</span>} />
                  <Row label="Holder Name" value={state.data.full_name} />
                  <Row label="Certificate" value={state.data.certificate_type} />
                  <Row label="Internship" value={state.data.internship_type} />
                  <Row label="Duration" value={`${state.data.duration_months} Month${state.data.duration_months > 1 ? "s" : ""}`} />
                  <Row label="Period" value={`${state.data.internship_start_date} — ${state.data.internship_end_date}`} />
                  <Row label="Registration ID" value={<span className="font-mono-tabular">{state.data.registration_id}</span>} />
                  <Row label="Status" value={state.data.certificate_status} />
                  {state.data.issued_on && (
                    <Row label="Issued On" value={state.data.issued_on.slice(0, 10)} />
                  )}
                </div>

                <p className="mt-5 text-xs text-slate-500 text-center">
                  This credential is officially registered with Veritech.AI. If any details appear
                  incorrect, please contact <a href="mailto:support@veritech.ai" className="text-blue-600 font-semibold">support@veritech.ai</a>.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
