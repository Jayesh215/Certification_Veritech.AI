import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, Navigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Receipt, Award, LogOut, Stamp, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { api, setAdminToken } from "../lib/api";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/registrations", label: "Registrations", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: Receipt },
  { to: "/admin/certificates", label: "Certificates", icon: Award },
  { to: "/admin/branding", label: "Branding", icon: Stamp },
];

function displayName(email) {
  const local = (email || "admin").split("@")[0].replace(/\d+$/, "");
  if (!local) return "Admin";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function SidebarNav({ onNavigate, logout, name, email, initials }) {
  return (
    <>
      <div className="flex items-center gap-2 rounded-2xl bg-white p-3">
        <Logo className="h-8" />
      </div>
      <nav className="mt-6 flex-1 space-y-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }
            data-testid={`admin-nav-${label.toLowerCase()}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-1">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-black">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{name}</p>
            <p className="truncate text-[11px] text-white/50">{email || "Admin"}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          data-testid="admin-logout-btn"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );
}

export default function AdminLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const token = typeof window !== "undefined" ? localStorage.getItem("veritech_admin_token") : null;
  const [email, setEmail] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get("/admin/me").then((r) => setEmail(r.data.email)).catch(() => {});
  }, [token]);

  // Close drawer when route changes (tablet/mobile nav click).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll while drawer is open on small screens.
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  if (!token) return <Navigate to="/admin/login" replace />;

  const logout = () => {
    setAdminToken(null);
    nav("/admin/login");
  };

  const name = displayName(email);
  const initials = name.slice(0, 1).toUpperCase();
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="h-screen overflow-hidden bg-[#f5f7fb]">
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#f5f7fb]">
        {/* Desktop / large tablet+: persistent sidebar */}
        <div className="hidden h-full shrink-0 p-3 lg:flex">
          <aside className="flex w-64 min-h-0 flex-col overflow-y-auto rounded-[28px] bg-[#0F172A] p-4 text-white">
            <SidebarNav logout={logout} name={name} email={email} initials={initials} />
          </aside>
        </div>

        {/* Mobile / tablet drawer sidebar */}
        <div
          className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}
          aria-hidden={!sidebarOpen}
        >
          <button
            type="button"
            className={`absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-200 ${
              sidebarOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeSidebar}
            aria-label="Close navigation"
            data-testid="admin-sidebar-overlay"
          />
          <aside
            className={`absolute left-0 top-0 flex h-full w-[min(18rem,86vw)] flex-col overflow-y-auto bg-[#0F172A] p-4 text-white shadow-2xl transition-transform duration-300 ease-out ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
            data-testid="admin-sidebar-drawer"
          >
            <div className="mb-2 flex items-center justify-end">
              <button
                type="button"
                onClick={closeSidebar}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close sidebar"
                data-testid="admin-sidebar-close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav
              onNavigate={closeSidebar}
              logout={logout}
              name={name}
              email={email}
              initials={initials}
            />
          </aside>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-3 px-3 py-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 lg:hidden"
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              aria-expanded={sidebarOpen}
              data-testid="admin-sidebar-toggle"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Logo className="h-6 shrink-0 lg:hidden" />
            </div>

            <div className="hidden items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-sm sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900">Hi, {name}</p>
                <p className="max-w-[180px] truncate text-[11px] text-slate-400">{email}</p>
              </div>
            </div>
            <button onClick={logout} className="text-xs font-semibold text-slate-500 lg:hidden">
              Sign out
            </button>
          </header>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 pb-5 sm:px-6 sm:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
