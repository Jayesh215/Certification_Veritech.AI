import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BadgeCheck, Briefcase, FileCheck, QrCode, ScanSearch, Share2 } from "lucide-react";
import { Logo } from "../components/Logo";
import AlumniReviews from "../components/AlumniReviews";

function Rise({ y = 60, delay = 0, trigger = "view", damping = 60, mass = 1, className = "", children }) {
  const reduce = useReducedMotion();
  const shown = { opacity: 1, y: 0 };
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={trigger === "mount" && !reduce ? shown : undefined}
      whileInView={trigger === "view" && !reduce ? shown : undefined}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ type: "spring", stiffness: 500, damping, mass, delay }}
    >
      {children}
    </motion.div>
  );
}

const navItems = [
  { to: "/", label: "Home", testid: "nav-home-link", end: true },
  { to: "/register", label: "Register", testid: "nav-register-link" },
  { to: "/status", label: "Track", testid: "nav-status-link" },
];

const highlights = [
  "Issued to Veritech.AI interns",
  "Role, dates, and a QR code",
  "Ready for resumes and applications",
];

const benefits = [
  {
    icon: BadgeCheck,
    title: "Proof you finished the internship",
    desc: "The certificate records your name, internship type, and dates. It is an official Veritech.AI record of the work you completed, not a line you typed on a resume yourself.",
  },
  {
    icon: Briefcase,
    title: "A stronger fresher resume",
    desc: "Most freshers only have coursework. Hiring teams at larger technology companies look for people who have already spent time on real tasks. An internship certificate shows the role and how long you did it.",
  },
  {
    icon: ScanSearch,
    title: "Employers can check it",
    desc: "Each certificate has a QR code and a registration ID. A recruiter or campus team can confirm it was issued by Veritech.AI instead of trusting an unverified PDF.",
  },
  {
    icon: FileCheck,
    title: "Fits application forms",
    desc: "Campus drives and fresher openings often ask for an internship or training certificate. You can attach this one when a form asks for proof of internship.",
  },
  {
    icon: Share2,
    title: "Useful on LinkedIn",
    desc: "Add the credential to your profile and resume while you apply. It gives you a clear internship to talk about in screening calls.",
  },
  {
    icon: QrCode,
    title: "One record you can track",
    desc: "Look the certificate up later by registration ID or email. The same ID is what you share if someone asks you to verify it.",
  },
];

export default function Landing() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const active = (path, end) => (end ? loc.pathname === path : loc.pathname.startsWith(path));

  function track(e) {
    e.preventDefault();
    const value = query.trim();
    navigate(value ? `/status?q=${encodeURIComponent(value)}` : "/status");
  }

  return (
    <div className="min-h-screen bg-white text-[#0F172A]" style={{ fontFamily: "Inter, sans-serif" }}>
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-5">
          <Link to="/" data-testid="header-logo-link" className="shrink-0">
            <Logo className="h-7" />
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {navItems.map(({ to, label, testid, end }) => (
              <Link
                key={to}
                to={to}
                data-testid={testid}
                className={`text-sm font-medium ${active(to, end) ? "text-[#2563EB]" : "text-slate-600 hover:text-slate-900"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/register"
              className="inline-flex items-center rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
            >
              Start Registration
            </Link>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
          {navItems.map(({ to, label, end }) => (
            <Link
              key={to}
              to={to}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium ${
                active(to, end) ? "bg-[#EFF6FF] text-[#2563EB]" : "text-slate-600"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-8 lg:grid-cols-2 lg:gap-12 lg:py-12">
          <div>
            <Rise y={40} delay={0.1} trigger="mount">
              <p className="inline-flex rounded-xl bg-[#EFF6FF] px-3 py-1 text-sm font-semibold text-[#2563EB]">
                For Veritech.AI interns
              </p>
            </Rise>
            <Rise y={60} delay={0.2} trigger="mount" className="mt-4">
              <h1 className="text-3xl font-semibold leading-[1.15] tracking-tight text-[#0F172A] sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
                Your internship certificate, ready to show employers.
              </h1>
            </Rise>
            <Rise y={80} delay={0.3} trigger="mount" className="mt-4">
              <p className="max-w-xl text-base leading-relaxed text-slate-500">
                Veritech.AI issues internship certificates to its interns. Register your details here and download a certificate with your name, role, dates, and a QR code you can add to a resume.
              </p>
            </Rise>
            <Rise y={60} delay={0.4} trigger="mount" className="mt-8">
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
                  data-testid="hero-start-registration-btn"
                >
                  Start Registration <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/status"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  data-testid="hero-track-status-btn"
                >
                  Track Application
                </Link>
              </div>
            </Rise>
            <Rise y={40} delay={0.55} trigger="mount" className="mt-8 max-w-xl text-left">
              <p className="text-sm font-semibold text-[#0F172A]">Employers can verify it</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                A QR code confirms this certificate was issued to a Veritech.AI intern.
              </p>
            </Rise>
          </div>
          <Rise y={120} delay={0.5} trigger="mount" damping={80} mass={2} className="mx-auto w-full max-w-[420px] lg:ml-auto lg:mr-0">
            <motion.img
              src="/certificate-preview.png"
              alt="Veritech.AI internship certificate"
              className="mx-auto max-h-[460px] w-full rounded-[20px] border border-slate-100 bg-white object-contain shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)]"
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34, delay: 0.45 }}
            />
          </Rise>
        </section>

        <section className="border-y border-slate-100 bg-[#F8FAFC]">
          <div className="mx-auto grid max-w-6xl gap-4 px-5 py-8 sm:grid-cols-3">
            {highlights.map((title, index) => (
              <Rise key={title} y={20} delay={0.2 + index * 0.15}>
                <p className="text-center text-sm font-semibold tracking-wide text-slate-400">{title}</p>
              </Rise>
            ))}
          </div>
        </section>

        <section className="bg-[#F8FAFC] px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <Rise y={60} delay={0.1} className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Why this certificate matters for freshers</h2>
              <p className="mt-4 text-base leading-relaxed text-slate-500">
                Larger technology companies receive a lot of fresher applications. A degree shows what you studied. An internship certificate shows you already worked: the role, the dates, and that Veritech.AI issued it. That proof helps you get past the first resume screen and gives you a concrete internship to discuss in interviews. It does not replace your projects or the interview itself.
              </p>
            </Rise>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {benefits.map(({ icon: Icon, title, desc }, index) => (
                <Rise key={title} y={60} delay={0.1 * (index + 1)}>
                  <motion.article
                    className="h-full rounded-[20px] border border-slate-100 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.25)]"
                    whileHover={{ y: -6 }}
                    transition={{ type: "spring", stiffness: 500, damping: 60 }}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{desc}</p>
                  </motion.article>
                </Rise>
              ))}
            </div>
          </div>
        </section>

        <AlumniReviews />

        <section className="px-5 py-20">
          <Rise y={60} delay={0.2} className="mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-[20px] bg-[#2563EB] px-6 py-10 text-white lg:grid-cols-[1.2fr_1fr] lg:px-12">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Already registered?</h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-blue-100">
                Look up your internship certificate by registration ID, certificate ID, or email. Share that ID when an employer asks you to confirm it.
              </p>
            </div>
            <form onSubmit={track} className="flex flex-col gap-3 sm:flex-row">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Registration ID, certificate ID, or email"
                className="w-full rounded-xl border-0 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button type="submit" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#2563EB] hover:bg-blue-50">
                Track
              </button>
            </form>
          </Rise>
        </section>
      </main>

      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Veritech.AI. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="https://www.veritech-ai.com" target="_blank" rel="noreferrer" className="font-semibold text-slate-700 hover:text-[#2563EB]">www.veritech-ai.com</a>
            <a href="mailto:info@veritech-ai.com" className="font-semibold text-slate-700 hover:text-[#2563EB]">info@veritech-ai.com</a>
            <a href="#" className="hover:text-slate-900">Privacy Policy</a>
            <a href="#" className="hover:text-slate-900">Terms &amp; Conditions</a>
            <a href="#" className="hover:text-slate-900">Refund Policy</a>
            <a href="#" className="hover:text-slate-900">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
