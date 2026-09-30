import { useNavigate } from "react-router-dom";
import { Pencil, ArrowRight } from "lucide-react";
import Stepper from "../components/Stepper";
import { useRegistration } from "../context/RegistrationContext";
import { formatCurrency, formatDuration } from "../lib/api";

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900 text-right">{value || "—"}</span>
    </div>
  );
}

export default function Review() {
  const nav = useNavigate();
  const { state } = useRegistration();
  const reg = state.registration;

  if (!reg) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-600">No registration found. Please fill the form first.</p>
        <button onClick={() => nav("/register")} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
          Go to Registration
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <Stepper current={2} />
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Review your details</h1>
        <p className="mt-2 text-slate-600">Please verify your information before proceeding to payment.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Personal Details</h2>
            <div className="mt-3 divide-y divide-slate-100">
              <Row label="Full Name" value={reg.full_name} />
              <Row label="Email" value={reg.email} />
              <Row label="Mobile" value={`+91 ${reg.mobile}`} />
              <Row label="College" value={reg.college} />
              <Row label="Course" value={reg.course} />
              <Row label="Graduation Year" value={reg.graduation_year} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Internship Details</h2>
            <div className="mt-3 divide-y divide-slate-100">
              <Row label="Internship" value={reg.internship_type} />
              <Row label="Start Date" value={reg.internship_start_date} />
              <Row label="End Date" value={reg.internship_end_date} />
              <Row label="Internship ID" value={reg.internship_id_input || reg.registration_id} />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Registration ID</p>
            <p className="mt-1 text-lg font-bold text-slate-900 font-mono-tabular" data-testid="review-registration-id">{reg.registration_id}</p>
            <div className="mt-4 h-px bg-slate-100" />
            <div className="mt-4 divide-y divide-slate-100">
              <Row label="Certificate" value={reg.certificate_type} />
              <Row label="Duration" value={formatDuration(reg.duration_months)} />
              <Row label="Amount" value={formatCurrency(reg.amount)} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2">
              <button
                onClick={() => nav("/register")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:border-slate-300 transition-colors"
                data-testid="review-edit-btn"
              >
                <Pencil className="h-4 w-4" /> Edit Details
              </button>
              <button
                onClick={() => nav("/payment")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                data-testid="review-proceed-btn"
              >
                Continue to Payment <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
