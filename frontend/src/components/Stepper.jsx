import { Check } from "lucide-react";

const STEPS = [
  { key: 1, label: "Details" },
  { key: 2, label: "Review" },
  { key: 3, label: "Payment" },
  { key: 4, label: "Complete" },
];

export default function Stepper({ current = 1, compact = false }) {
  return (
    <div
      className={compact
        ? "mb-3 rounded-2xl bg-white px-3 py-2 shadow-sm sm:px-5"
        : "mb-4 rounded-[28px] bg-white px-4 py-5 shadow-sm sm:px-6"}
      data-testid="stepper"
    >
      <ol className="grid grid-cols-4">
        {STEPS.map((s, i) => {
          const done = current > s.key;
          const active = current === s.key;
          return (
            <li key={s.key} className="relative flex flex-col items-center">
              {i < STEPS.length - 1 && (
                <div
                  className={`absolute left-1/2 h-0.5 w-full -translate-y-1/2 ${
                    compact ? "top-3.5" : "top-[18px]"
                  } ${done ? "bg-blue-600" : "bg-slate-200"}`}
                />
              )}
              <div
                className={`relative z-10 flex items-center justify-center rounded-full font-bold transition-all ${
                  compact ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm"
                } ${
                  active
                    ? "bg-blue-600 text-white"
                    : done
                    ? "bg-blue-100 text-blue-700"
                    : "bg-[#f6f7fb] text-slate-400"
                }`}
                data-testid={`step-${s.key}`}
              >
                {done ? <Check className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} /> : s.key}
              </div>
              <span className={`mt-1 font-medium whitespace-nowrap ${
                compact ? "text-[11px]" : "text-xs"
              } ${
                active ? "text-slate-900" : done ? "text-slate-600" : "text-slate-400"
              }`}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
