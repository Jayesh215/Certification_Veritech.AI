import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Lock, Check, Columns3, X, ArrowLeft, Star } from "lucide-react";
import ComparePlansModal from "../components/ComparePlansModal";
import { PlansSkeleton } from "../components/PageSkeletons";
import { useRegistration } from "../context/RegistrationContext";
import { api, formatCurrency, formatDateRange, formatDuration, PLAN_PERKS } from "../lib/api";

export default function Payment() {
  const nav = useNavigate();
  const { state, update } = useRegistration();
  const reg = state.registration;
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selected, setSelected] = useState(
    Number.isFinite(reg?.duration_months) ? reg.duration_months : 3,
  );
  const [processing, setProcessing] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [certPreparing, setCertPreparing] = useState(false);
  const paymentSucceededRef = useRef(false);

  useEffect(() => {
    if (!checkoutOpen && !certPreparing) return;
    const onEsc = (e) => {
      if (e.key === "Escape" && !processing && !certPreparing) setCheckoutOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [checkoutOpen, processing, certPreparing]);

  useEffect(() => {
    setPlansLoading(true);
    api
      .get("/plans")
      .then((r) => setPlans(Array.isArray(r.data) ? r.data : []))
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
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
    if (!selectedPlan || processing) return;
    setProcessing("razorpay");
    try {
      const { data: order } = await api.post("/payments/order", {
        registration_id: reg.registration_id,
        duration_months: selected,
        gateway: "razorpay",
      });
      // Sync updated amount to local state
      update({ registration: { ...reg, duration_months: selected, amount: selectedPlan.price } });

      if (order.mock) {
        toast.error("Razorpay is not configured. Check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.");
        return;
      }

      if (!window.Razorpay) {
        toast.error("Razorpay checkout script not loaded. Please refresh.");
        return;
      }
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Veritech.AI",
        description: `${formatDuration(selected)} Certificate Registration`,
        order_id: order.order_id,
        prefill: { name: order.name, email: order.email, contact: order.mobile },
        theme: { color: "#2563EB" },
        handler: async (resp) => {
          paymentSucceededRef.current = true;
          setCheckoutOpen(false);
          setCertPreparing(true);
          setProcessing(null);
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
            } else {
              setCertPreparing(false);
              nav("/failed");
            }
          } catch {
            setCertPreparing(false);
            nav("/failed");
          }
        },
        modal: {
          ondismiss: () => {
            if (paymentSucceededRef.current) return;
            // If Razorpay reported a failure earlier, user closed the failure screen → send them to /failed
            if (window.__vt_payment_failed) {
              window.__vt_payment_failed = false;
              setCheckoutOpen(false);
              nav("/failed");
            } else {
              toast.info("Payment cancelled. Your details are saved.");
              setProcessing(null);
            }
          },
        },
      };
      window.__vt_payment_failed = false;
      paymentSucceededRef.current = false;
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
      setProcessing(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Certificate plans</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
          Choose the internship duration for your Veritech.AI certificate. The plan you pick is printed as the certificate duration.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => nav("/review")}
            className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-900"
            data-testid="plans-back-btn"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <button
            onClick={() => setCompareOpen(true)}
            className="inline-flex items-center gap-2 font-medium text-slate-500 hover:text-slate-900"
            data-testid="open-compare-plans-btn"
          >
            <Columns3 className="h-4 w-4" /> Compare all plans
          </button>
        </div>
      </div>

      <div
        className="rounded-[28px] px-3 py-8 sm:px-6"
        style={{
          backgroundImage: "linear-gradient(to right, #eef2f6 1px, transparent 1px), linear-gradient(to bottom, #eef2f6 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      >
        {plansLoading ? (
          <PlansSkeleton />
        ) : (
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-5">
          {plans.map((p) => {
            const active = selected === p.duration_months;
            const key = p.duration_months === 0 ? "1d" : `${p.duration_months}m`;
            const perks = PLAN_PERKS[p.duration_months] || [];
            const popular = Boolean(p.popular);
            const career = p.duration_months === 3 || p.duration_months === 6;
            return (
              <article
                key={p.duration_months}
                data-testid={`duration-card-${key}`}
                onClick={() => setSelected(p.duration_months)}
                className={`relative flex cursor-pointer flex-col rounded-[24px] border bg-white p-6 ${
                  career
                    ? "border-blue-300 shadow-[0_24px_50px_-24px_rgba(37,99,235,0.55)] xl:-mt-2"
                    : "border-slate-200/80 shadow-sm"
                } ${active ? "ring-2 ring-slate-900" : ""}`}
              >
                {(popular || career) && (
                  <div className="absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
                    {popular && (
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white">
                        Most Popular
                      </span>
                    )}
                    {career && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        <Star className="h-3 w-3 fill-emerald-500 text-emerald-600" /> Career
                      </span>
                    )}
                  </div>
                )}
                <div className={career ? "-mx-6 -mt-6 mb-4 rounded-t-[24px] bg-gradient-to-b from-blue-50 via-white to-white px-6 pb-2 pt-8" : ""}>
                  <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
                  {formatDateRange(p.start_date, p.end_date) && (
                    <p className="mt-1 text-xs font-semibold text-blue-600">{formatDateRange(p.start_date, p.end_date)}</p>
                  )}
                  <p className="mt-1 min-h-[32px] text-xs leading-snug text-slate-500">{p.description}</p>
                  <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
                    ₹{Number(p.price).toLocaleString("en-IN")}
                    <span className="text-base font-normal text-slate-400"> / Certificate</span>
                  </p>
                </div>
                <ul className="mt-3 flex-1 space-y-1.5" data-testid={`perks-${key}`}>
                  {perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5 text-[11px] leading-tight text-slate-600">
                      <span className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500">
                        <Check className="h-2 w-2" strokeWidth={2.5} />
                      </span>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selected === p.duration_months) setCheckoutOpen(true);
                    else setSelected(p.duration_months);
                  }}
                  className={`mt-4 w-full rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  {active ? "Selected" : "Get started"}
                </button>
              </article>
            );
          })}
        </div>
        )}
      </div>

      {certPreparing && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
          data-testid="certificate-loading-screen"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-sm rounded-[28px] border border-slate-200 bg-white px-8 py-10 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
            <p className="mt-5 text-lg font-semibold tracking-tight text-slate-900">
              Your certificate is loading
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Payment received. We&apos;re preparing your Veritech.AI certificate — this only takes a moment.
            </p>
          </div>
        </div>
      )}

      {checkoutOpen && !certPreparing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => !processing && setCheckoutOpen(false)}
          data-testid="checkout-modal"
        >
          <div
            className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">Complete payment</p>
                <p className="mt-1 text-sm text-slate-500">{reg.full_name} · {formatDuration(selected)} Certificate{formatDateRange(selectedPlan?.start_date, selectedPlan?.end_date) ? ` · ${formatDateRange(selectedPlan.start_date, selectedPlan.end_date)}` : ""}</p>
                <p className="mt-1 font-mono text-xs text-slate-400">{reg.registration_id}</p>
              </div>
              <button
                type="button"
                onClick={() => !processing && setCheckoutOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900" data-testid="order-summary-total">
              {formatCurrency(selectedPlan?.price || 0)}
            </p>
            <button
              onClick={() => proceedPay()}
              disabled={!!processing || !selectedPlan}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0C2454] px-5 py-3 text-sm font-semibold text-white hover:bg-[#081a3d] disabled:opacity-50"
              data-testid="razorpay-pay-button"
            >
              {processing === "razorpay" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white text-[10px] font-extrabold tracking-tight text-[#0C2454]">
                  Rz
                </span>
              )}
              Pay with Razorpay
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Original Razorpay checkout · UPI, cards, netbanking & wallets
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <Lock className="h-3 w-3" />
              256-bit SSL · Razorpay Secure Gateway
            </div>
          </div>
        </div>
      )}

      <ComparePlansModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        onSelect={(d) => setSelected(d)}
        selectedDuration={selected}
      />
    </div>
  );
}
