import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import { useRegistration } from "../context/RegistrationContext";
import { formatCurrency, formatDuration } from "../lib/api";

export default function Failed() {
  const nav = useNavigate();
  const { state } = useRegistration();
  const reg = state.registration;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-lg overflow-hidden">
        <div className="h-2 w-full bg-red-500" />
        <div className="p-8 sm:p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 ring-4 ring-red-100">
            <XCircle className="h-9 w-9 text-red-600" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold text-slate-900 tracking-tight">Payment could not be completed</h1>
          <p className="mt-2 text-slate-600">Your payment was not successful. Your registration details have been saved — please try again.</p>

          {reg && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left">
              <div className="flex justify-between py-1"><span className="text-sm text-slate-500">Registration ID</span><span className="text-sm font-semibold font-mono-tabular">{reg.registration_id}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Selected Plan</span><span className="text-sm font-semibold">{formatDuration(reg.duration_months)}</span></div>
              <div className="flex justify-between py-1"><span className="text-sm text-slate-500">Amount</span><span className="text-sm font-semibold font-mono-tabular">{formatCurrency(reg.amount)}</span></div>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => nav("/payment")}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              data-testid="retry-payment-btn"
            >
              Try Payment Again
            </button>
            <button
              onClick={() => nav("/payment")}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-300"
              data-testid="change-plan-btn"
            >
              Change Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
