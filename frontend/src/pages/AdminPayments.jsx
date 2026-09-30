import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileDown, Undo2, Loader2, X } from "lucide-react";
import { api, API_BASE, formatCurrency } from "../lib/api";

async function downloadCsv(path, filename) {
  const token = localStorage.getItem("veritech_admin_token");
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const StatusBadge = ({ s }) => {
  const map = {
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CREATED: "bg-slate-50 text-slate-700 border-slate-200",
    FAILED: "bg-red-50 text-red-700 border-red-200",
    REFUNDED: "bg-blue-50 text-blue-700 border-blue-200",
    PARTIALLY_REFUNDED: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const label = { PARTIALLY_REFUNDED: "PARTIAL REFUND" }[s] || s;
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${map[s] || map.CREATED}`}>{label}</span>;
};

function RefundModal({ payment, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(payment.amount);
  const [full, setFull] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (reason.trim().length < 3) {
      toast.error("Please enter a reason (min 3 characters)");
      return;
    }
    setBusy(true);
    try {
      const body = { reason: reason.trim() };
      if (!full) body.amount = Number(amount);
      const { data } = await api.post(`/admin/payments/${payment.registration_id}/refund`, body);
      toast.success(`Refund initiated · ${data.refund_id}`);
      onDone();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Refund failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-testid="refund-modal">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Issue refund</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono-tabular">{payment.registration_id} · {payment.razorpay_payment_id}</p>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Captured amount</span><span className="font-mono-tabular font-bold text-slate-900">{formatCurrency(payment.amount)}</span></div>
            <div className="flex justify-between text-sm mt-1"><span className="text-slate-500">Intern</span><span className="font-semibold text-slate-900">{payment.full_name}</span></div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-1">
            <button
              onClick={() => { setFull(true); setAmount(payment.amount); }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${full ? "bg-slate-900 text-white" : "text-slate-600"}`}
              data-testid="refund-full-toggle"
            >Full refund</button>
            <button
              onClick={() => setFull(false)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${!full ? "bg-slate-900 text-white" : "text-slate-600"}`}
              data-testid="refund-partial-toggle"
            >Partial</button>
          </div>

          {!full && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Refund Amount (₹)</label>
              <input
                type="number"
                min="1"
                max={payment.amount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm veritech-focus"
                data-testid="refund-amount-input"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Reason <span className="text-red-500">*</span></label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Duplicate payment for the same registration"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm veritech-focus resize-none"
              data-testid="refund-reason-input"
            />
            <p className="mt-1 text-[11px] text-slate-500">Stored in the audit log and sent to Razorpay as a note.</p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
            Refunds are irreversible and processed via Razorpay. Funds usually reach the intern in 5–7 working days.
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300" data-testid="refund-cancel-btn">Cancel</button>
          <button
            onClick={submit}
            disabled={busy || reason.trim().length < 3}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            data-testid="refund-confirm-btn"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Confirm refund
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPayments() {
  const [rows, setRows] = useState([]);
  const [refundFor, setRefundFor] = useState(null);

  const load = () => api.get("/admin/payments").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Payment Transactions</h1>
          <p className="mt-1 text-sm text-slate-500">All Razorpay orders, verifications and refunds.</p>
        </div>
        <button
          onClick={() => downloadCsv("/admin/payments/export", "veritech-payments.csv")}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          data-testid="export-payments-csv"
        >
          <FileDown className="h-4 w-4" /> Export CSV
        </button>
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
                <th className="text-left px-4 py-3 font-semibold">Failure / Refund</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
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
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">
                    {p.status === "FAILED" && (p.failure_description || p.failure_code || "—")}
                    {(p.status === "REFUNDED" || p.status === "PARTIALLY_REFUNDED") && (
                      <div>
                        <div className="font-semibold text-slate-800">{formatCurrency(p.refund_amount)} · {p.refund_id}</div>
                        <div className="mt-0.5 text-slate-500 truncate" title={p.refund_reason}>{p.refund_reason}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    {p.status === "PAID" && (
                      <button
                        onClick={() => setRefundFor(p)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:border-red-200 hover:text-red-600"
                        data-testid={`refund-btn-${p.registration_id}`}
                      ><Undo2 className="h-3 w-3" /> Refund</button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-sm text-slate-500">No payments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {refundFor && (
        <RefundModal
          payment={refundFor}
          onClose={() => setRefundFor(null)}
          onDone={() => { setRefundFor(null); load(); }}
        />
      )}
    </div>
  );
}
