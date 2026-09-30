import { useNavigate, Link } from "react-router-dom";
import { CheckCircle2, Download, ArrowRight } from "lucide-react";
import Stepper from "../components/Stepper";
import { useRegistration } from "../context/RegistrationContext";
import { API_BASE, formatCurrency, formatDuration } from "../lib/api";

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold text-slate-900 text-right ${mono ? "font-mono-tabular" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

export default function Success() {
  const nav = useNavigate();
  const { state } = useRegistration();
  const reg = state.registration;

  if (!reg) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-600">No registration found.</p>
        <Link to="/register" className="mt-4 inline-block rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
          Start Registration
        </Link>
      </div>
    );
  }

  const paidDate = reg.paid_at
    ? new Date(reg.paid_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <Stepper current={4} />
      <div className="rounded-3xl border border-slate-200 bg-white shadow-lg overflow-hidden">
        <div className="h-2 w-full bg-emerald-500" />
        <div className="p-8 sm:p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Payment Successful!</h1>
          <p className="mt-2 text-slate-600">Your Veritech.AI certificate registration is complete.</p>

          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 border border-emerald-200">
              ✓ Registration Completed
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 border border-emerald-200">
              ✓ Payment Confirmed
            </span>
          </div>
        </div>

        <div className="mx-8 sm:mx-10 mb-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
          <div className="divide-y divide-slate-200">
            <InfoRow label="Registration ID" value={reg.registration_id} mono />
            <InfoRow label="Payment ID" value={reg.razorpay_payment_id} mono />
            <InfoRow label="Certificate" value={reg.certificate_type} />
            <InfoRow label="Duration" value={formatDuration(reg.duration_months)} />
            <InfoRow label="Amount Paid" value={formatCurrency(reg.amount)} mono />
            <InfoRow label="Email" value={reg.email} />
            <InfoRow label="Payment Status" value={<span className="text-emerald-700">PAID</span>} />
            <InfoRow label="Date" value={paidDate} />
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white p-6 sm:p-8 flex flex-col sm:flex-row items-stretch gap-3 justify-center">
          <button
            onClick={() => nav("/status")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-300 transition-colors"
            data-testid="view-registration-btn"
          >
            View Registration <ArrowRight className="h-4 w-4" />
          </button>
          <a
            href={`${API_BASE}/receipts/${reg.registration_id}/download`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            data-testid="receipt-download-pdf-btn"
          >
            <Download className="h-4 w-4" /> Download Receipt
          </a>
          <a
            href={`${API_BASE}/certificates/${reg.registration_id}/download`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            data-testid="certificate-download-pdf-btn"
          >
            <Download className="h-4 w-4" /> Download Certificate
          </a>
        </div>

        <p className="p-6 text-center text-xs text-slate-500">
          A confirmation will be sent to <span className="font-semibold text-slate-700">{reg.email}</span>
        </p>
      </div>
    </div>
  );
}
