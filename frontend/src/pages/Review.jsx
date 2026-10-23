import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRegistration } from "../context/RegistrationContext";
import { datesFor, durationWithDates } from "../lib/api";
import useInternshipPeriods from "../lib/useInternshipPeriods";

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] items-baseline gap-3 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[11rem_1fr]">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900 break-words">{value || "—"}</span>
    </div>
  );
}

function Panel({ title, hint, children }) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default function Review() {
  const nav = useNavigate();
  const { state } = useRegistration();
  const periods = useInternshipPeriods();
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

  const dates = datesFor(periods, reg.duration_months, reg);
  const duration = `${durationWithDates(reg.duration_months, dates.start, dates.end)} Certificate`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => nav("/register")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
        data-testid="review-back-btn"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Review your details</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Check the name, internship, and duration below. These are the details printed on your {reg.certificate_type}.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Panel title="Your details" hint="This is how your name will appear on the certificate.">
          <Row label="Full name" value={reg.full_name} />
          <Row label="Email" value={reg.email} />
          <Row label="Mobile" value={reg.mobile ? `+91 ${reg.mobile}` : ""} />
          <Row label="College" value={reg.college} />
          <Row label="Course" value={reg.course} />
          <Row label="Graduation year" value={reg.graduation_year} />
        </Panel>

        <Panel title="Internship certificate" hint="Save your registration ID. You can use it later to track this certificate.">
          <div className="mb-2 rounded-2xl bg-[#EFF6FF] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Registration ID</p>
            <p className="mt-1 font-mono text-lg font-semibold text-slate-900" data-testid="review-registration-id">{reg.registration_id}</p>
          </div>
          <Row label="Internship" value={reg.internship_type} />
          <Row label="Internship ID" value={reg.internship_id_input || reg.registration_id} />
          <Row label="Certificate" value={reg.certificate_type} />
          <Row label="Duration" value={duration} />
        </Panel>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => nav("/register")}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-300"
          data-testid="review-edit-btn"
        >
          <ArrowLeft className="h-4 w-4" /> Back to details
        </button>
        <button
          type="button"
          onClick={() => nav("/payment")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          data-testid="review-proceed-btn"
        >
          Collect your certificate instantly <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
