import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Award, QrCode } from "lucide-react";

const trustPoints = [
  { icon: ShieldCheck, title: "Official Veritech.AI Portal", desc: "Authentic certificate registration with verified issuance." },
  { icon: QrCode, title: "Tamper-proof Verification", desc: "Each certificate is registered with a unique traceable ID." },
  { icon: Award, title: "Recognised Credential", desc: "Add your Veritech.AI credential to LinkedIn and resumes." },
];

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[620px] hero-grid pointer-events-none" />
      <div className="vt-blob" style={{ top: "-80px", left: "-80px", width: "420px", height: "420px", background: "radial-gradient(circle, #93C5FD 0%, transparent 70%)" }} />
      <div className="vt-blob" style={{ top: "120px", right: "-100px", width: "380px", height: "380px", background: "radial-gradient(circle, #DBEAFE 0%, transparent 70%)", animationDelay: "-6s" }} />
      <div className="vt-blob" style={{ top: "280px", left: "40%", width: "320px", height: "320px", background: "radial-gradient(circle, #BFDBFE 0%, transparent 70%)", animationDelay: "-12s" }} />

      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-14">
        <div className="flex flex-col items-start gap-5">
          <div className="vt-anim-up inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700 tracking-wide">
              Official Veritech.AI Certificate Portal
            </span>
          </div>

          <h1 className="vt-anim-up vt-delay-1 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.05] max-w-3xl">
            Complete your <span className="vt-shimmer-text">certificate registration</span> in minutes.
          </h1>

          <p className="vt-anim-up vt-delay-2 max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed">
            Submit your internship details, choose your certificate duration, and complete a secure payment
            to receive your official Veritech.AI credential.
          </p>

          <div className="vt-anim-up vt-delay-3 mt-2 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="vt-cta inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(37,99,235,0.6)] hover:bg-blue-700 hover:shadow-[0_12px_32px_-12px_rgba(37,99,235,0.7)] transition-all"
              data-testid="hero-start-registration-btn"
            >
              Start Registration <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/status"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 backdrop-blur px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-white transition-all"
              data-testid="hero-track-status-btn"
            >
              Track Application
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {trustPoints.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              className={`group vt-anim-up vt-delay-${4 + i} vt-lift rounded-2xl border border-slate-200 bg-white p-5 shadow-sm`}
            >
              <div className="vt-icon-tile flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
