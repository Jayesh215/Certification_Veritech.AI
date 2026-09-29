import { NavLink, Outlet, useNavigate, Navigate } from "react-router-dom";
import { LayoutDashboard, Users, Receipt, Award, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { setAdminToken } from "../lib/api";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/registrations", label: "Registrations", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: Receipt },
  { to: "/admin/certificates", label: "Certificates", icon: Award },
];

export default function AdminLayout() {
  const nav = useNavigate();
  const token = typeof window !== "undefined" ? localStorage.getItem("veritech_admin_token") : null;
  if (!token) return <Navigate to="/admin/login" replace />;

  const logout = () => {
    setAdminToken(null);
    nav("/admin/login");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="hidden lg:flex w-64 min-h-screen bg-slate-900 text-slate-200 flex-col p-4">
          <div className="flex items-center gap-2 rounded-xl bg-white p-3">
            <Logo className="h-7" />
          </div>
          <nav className="mt-6 flex-1 space-y-1">
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`
                }
                data-testid={`admin-nav-${label.toLowerCase()}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={logout}
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800"
            data-testid="admin-logout-btn"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </aside>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-auto">
          {/* Mobile top nav */}
          <div className="lg:hidden mb-4 flex items-center gap-2 overflow-x-auto">
            {items.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${isActive ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"}`
                }
              >{label}</NavLink>
            ))}
            <button onClick={logout} className="ml-auto text-xs text-slate-500">Sign out</button>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
