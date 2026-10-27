import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";

const links = [
  { to: "/", label: "Home", testid: "nav-home-link" },
  { to: "/register", label: "Register", testid: "nav-register-link" },
  { to: "/status", label: "Track", testid: "nav-status-link" },
];

export default function Header() {
  const loc = useLocation();
  const active = (path) => (path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(path));

  return (
    <header className="sticky top-0 z-40 w-full bg-[#f5f7fb]/90 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center" data-testid="header-logo-link">
          <Logo className="h-7 sm:h-8" />
        </Link>
        <nav className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm">
          {links.map(({ to, label, testid }) => (
            <Link
              key={to}
              to={to}
              data-testid={testid}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                active(to) ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
