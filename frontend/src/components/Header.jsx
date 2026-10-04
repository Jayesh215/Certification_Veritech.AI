import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";

export default function Header() {
  const loc = useLocation();

  const linkCls = (path) =>
    `whitespace-nowrap text-xs sm:text-sm font-medium transition-colors ${
      loc.pathname === path
        ? "text-blue-700"
        : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3" data-testid="header-logo-link">
          <Logo className="h-7 sm:h-9" />
          <span className="hidden sm:block h-6 w-px bg-slate-200" />
          <span className="hidden sm:block text-sm font-semibold text-slate-700 tracking-tight">
            Certificate Portal
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2.5 sm:gap-6">
          <Link to="/register" className={linkCls("/register")} data-testid="nav-register-link">Register</Link>
          <Link to="/status" className={linkCls("/status")} data-testid="nav-status-link">Track Status</Link>
          <Link
            to="/admin/login"
            className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            data-testid="nav-admin-link"
          >
            Admin
          </Link>
        </nav>
      </div>
      <div className="h-0.5 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600" />
    </header>
  );
}
