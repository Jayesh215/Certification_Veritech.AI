import { useEffect, useState } from "react";
import { api, formatCurrency } from "../lib/api";

const StatusBadge = ({ s }) => {
  const map = {
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CREATED: "bg-slate-50 text-slate-700 border-slate-200",
    FAILED: "bg-red-50 text-red-700 border-red-200",
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${map[s] || map.CREATED}`}>{s}</span>;
};

export default function AdminPayments() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/admin/payments").then((r) => setRows(r.data)); }, []);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Payment Transactions</h1>
        <p className="mt-1 text-sm text-slate-500">All Razorpay orders and their verification status.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Order ID</th>
                <th className="text-left px-4 py-3 font-semibold">Registration ID</th>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Payment ID</th>
                <th className="text-left px-4 py-3 font-semibold">Amount</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Mode</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.razorpay_order_id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-mono-tabular text-xs">{p.razorpay_order_id}</td>
                  <td className="px-4 py-3 font-mono-tabular text-xs font-semibold">{p.registration_id}</td>
                  <td className="px-4 py-3">{p.full_name}</td>
                  <td className="px-4 py-3 font-mono-tabular text-xs">{p.razorpay_payment_id || "—"}</td>
                  <td className="px-4 py-3 font-mono-tabular">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3"><StatusBadge s={p.status} /></td>
                  <td className="px-4 py-3 text-slate-500 uppercase text-xs font-semibold">{p.mode}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-slate-500">No payments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
