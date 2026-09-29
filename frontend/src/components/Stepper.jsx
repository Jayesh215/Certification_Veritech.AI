import { Check } from "lucide-react";

const STEPS = [
  { key: 1, label: "Details" },
  { key: 2, label: "Review" },
  { key: 3, label: "Payment" },
  { key: 4, label: "Complete" },
];

export default function Stepper({ current = 1 }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6" data-testid="stepper">
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = current > s.key;
          const active = current === s.key;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                    active
                      ? "bg-blue-600 text-white ring-4 ring-blue-100"
                      : done
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}
                  data-testid={`step-${s.key}`}
                >
                  {done ? <Check className="h-4 w-4" /> : s.key}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  active ? "text-slate-900" : done ? "text-slate-600" : "text-slate-400"
                }`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mb-6 transition-all ${
                  done ? "bg-slate-900" : "bg-slate-200"
                }`} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
