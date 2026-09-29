import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Award, QrCode, Sparkles } from "lucide-react";
import { Logo } from "../components/Logo";

const trustPoints = [
  { icon: ShieldCheck, title: "Official Veritech.AI Portal", desc: "Authentic certificate registration with verified issuance." },
  { icon: QrCode, title: "Tamper-proof Verification", desc: "Each certificate is registered with a unique traceable ID." },
  { icon: Award, title: "Recognised Credential", desc: "Add your Veritech.AI credential to LinkedIn and resumes." },
];

export default function Landing() {
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[520px] hero-grid pointer-events-none" />
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-14">
        <div className="flex flex-col items-start gap-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700 tracking-wide">
              Official Veritech.AI Certificate Portal
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.05] max-w-3xl">
            Complete your <span className="text-blue-600">certificate registration</span> in minutes.
          </h1>
          <p className="max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed">
            Submit your internship details, choose your certificate duration, and complete a secure payment
            to receive your official Veritech.AI credential.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all"
              data-testid="hero-start-registration-btn"
            >
              Start Registration <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/status"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-300 transition-all"
              data-testid="hero-track-status-btn"
            >
              Track Application
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {trustPoints.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Pricing preview */}
        <div className="mt-16 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Certificate Plans</p>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Transparent pricing. No surprises.
              </h2>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" /> Choose any duration during checkout
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { d: "1 Month", p: 99 },
              { d: "2 Months", p: 149 },
              { d: "3 Months", p: 199, popular: true },
              { d: "6 Months", p: 499 },
            ].map((plan) => (
              <div
                key={plan.d}
                className={`relative rounded-2xl border p-4 sm:p-5 ${
                  plan.popular ? "border-blue-600 bg-blue-50/40" : "border-slate-200 bg-white"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Popular
                  </span>
                )}
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{plan.d}</p>
                <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono-tabular">
                  ₹{plan.p}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
