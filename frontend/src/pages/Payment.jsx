import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Lock } from "lucide-react";
import Stepper from "../components/Stepper";
import { useRegistration } from "../context/RegistrationContext";
import { api, formatCurrency, formatDuration } from "../lib/api";

export default function Payment() {
  const nav = useNavigate();
  const { state, update } = useRegistration();
  const reg = state.registration;
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(reg?.duration_months ?? 3);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    api.get("/plans").then((r) => setPlans(r.data)).catch(() => setPlans([]));
  }, []);

  if (!reg) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-600">No registration found.</p>
        <button onClick={() => nav("/register")} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
          Go to Registration
        </button>
      </div>
    );
  }

  const selectedPlan = plans.find((p) => p.duration_months === selected);

  async function proceedPay() {
    if (!selectedPlan) return;
    setProcessing(true);
    try {
      const { data: order } = await api.post("/payments/order", {
        registration_id: reg.registration_id,
        duration_months: selected,
      });
      // Sync updated amount to local state
      update({ registration: { ...reg, duration_months: selected, amount: selectedPlan.price } });

      if (order.mock) {
        // Mock Razorpay flow
        await new Promise((r) => setTimeout(r, 900));
        const { data: v } = await api.post("/payments/mock-complete", {
          registration_id: reg.registration_id,
          success: true,
        });
        if (v.verified) {
          const { data: updated } = await api.get(`/registrations/${reg.registration_id}`);
          update({ registration: updated });
          nav("/success");
        } else {
          nav("/failed");
        }
        return;
      }

      // Real Razorpay
      if (!window.Razorpay) {
        toast.error("Payment gateway not loaded. Please refresh.");
        return;
      }
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Veritech.AI",
        description: `${selected}-Month Certificate Registration`,
        order_id: order.order_id,
        prefill: { name: order.name, email: order.email, contact: order.mobile },
        theme: { color: "#2563EB" },
        handler: async (resp) => {
          try {
            const { data: v } = await api.post("/payments/verify", {
              registration_id: reg.registration_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            if (v.verified) {
              const { data: updated } = await api.get(`/registrations/${reg.registration_id}`);
              update({ registration: updated });
              nav("/success");
            } else nav("/failed");
          } catch {
            nav("/failed");
          }
        },
        modal: {
          ondismiss: () => {
            // If Razorpay reported a failure earlier, user closed the failure screen → send them to /failed
            if (window.__vt_payment_failed) {
              window.__vt_payment_failed = false;
              nav("/failed");
            } else {
              toast.info("Payment cancelled. Your details are saved.");
            }
          },
        },
      };
      window.__vt_payment_failed = false;
      const rz = new window.Razorpay(options);
      rz.on("payment.failed", async (resp) => {
        // Mark for /failed navigation on dismiss, and record the failure server-side.
        // Do NOT close the modal — Razorpay shows its own failure screen with a Retry button.
        window.__vt_payment_failed = true;
        try {
          await api.post("/payments/record-failure", {
            registration_id: reg.registration_id,
            razorpay_order_id: resp?.error?.metadata?.order_id,
            razorpay_payment_id: resp?.error?.metadata?.payment_id,
            code: resp?.error?.code,
            description: resp?.error?.description,
            reason: resp?.error?.reason,
            source: resp?.error?.source,
            step: resp?.error?.step,
          });
        } catch { /* non-blocking */ }
      });
      rz.open();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not initiate payment");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <Stepper current={3} />
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Choose your certificate duration</h1>
        <p className="mt-2 text-slate-600">Select the certificate duration you want to register for.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((p) => {
              const active = selected === p.duration_months;
              const key = p.duration_months === 0 ? "1d" : `${p.duration_months}m`;
              return (
                <button
                  key={p.duration_months}
                  onClick={() => setSelected(p.duration_months)}
                  data-testid={`duration-card-${key}`}
                  className={`relative text-left rounded-2xl border p-5 sm:p-6 transition-all ${
                    active
                      ? "border-blue-600 bg-blue-50/40 shadow-md ring-1 ring-blue-600/10"
                      : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm"
                  }`}
                >
                  {p.popular && (
                    <span className="absolute -top-2.5 left-5 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                      Most Popular
                    </span>
                  )}
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{p.name}</p>
                  <p className="mt-3 text-3xl font-extrabold text-slate-900 font-mono-tabular">
                    ₹{p.price}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{p.description}</p>
                  <div className={`mt-5 inline-flex items-center gap-1.5 text-xs font-semibold ${
                    active ? "text-blue-700" : "text-slate-500"
                  }`}>
                    <span className={`inline-block h-2 w-2 rounded-full ${
                      active ? "bg-blue-600" : "bg-slate-300"
                    }`} />
                    {active ? "Selected" : "Select Plan"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-fit sticky top-24">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Order Summary</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Intern</span><span className="font-semibold text-slate-900">{reg.full_name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Certificate</span><span className="font-semibold text-slate-900">{reg.certificate_type}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="font-semibold text-slate-900">{formatDuration(selected)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Registration ID</span><span className="font-mono-tabular text-xs font-semibold text-slate-900">{reg.registration_id}</span></div>
          </div>
          <div className="my-5 h-px bg-slate-100" />
          <div className="flex items-end justify-between">
            <span className="text-sm font-medium text-slate-600">Total</span>
            <span className="text-3xl font-extrabold text-slate-900 font-mono-tabular" data-testid="order-summary-total">
              {formatCurrency(selectedPlan?.price || 0)}
            </span>
          </div>
          <button
            onClick={proceedPay}
            disabled={processing || !selectedPlan}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all"
            data-testid="razorpay-pay-button"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Proceed to Secure Payment
          </button>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            256-bit SSL · Razorpay Secure Gateway
          </div>
        </aside>
      </div>
    </div>
  );
}
