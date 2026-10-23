import { useMemo, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "../lib/utils";

function parseValue(value) {
  if (!value) return undefined;
  try {
    const d = parseISO(String(value).slice(0, 10));
    return isValid(d) ? d : undefined;
  } catch {
    return undefined;
  }
}

function toIso(date) {
  if (!date || !isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
}

function displayLabel(value) {
  const d = parseValue(value);
  return d ? format(d, "dd-MM-yyyy") : "Pick date";
}

/**
 * Themed date pill + calendar popover (matches Overview filter controls).
 * value / onChange use YYYY-MM-DD strings.
 */
export default function DatePillPicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick date",
  className,
  testId = "date-pill-picker",
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseValue(value), [value]);
  const minDate = useMemo(() => parseValue(min), [min]);
  const maxDate = useMemo(() => parseValue(max), [max]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "vt-filter-pill vt-date-pill inline-flex items-center gap-1.5",
            !value && "text-slate-400",
            className,
          )}
          data-testid={testId}
          aria-label={placeholder}
        >
          <span className="min-w-[4.75rem] text-left tabular-nums">
            {value ? displayLabel(value) : placeholder}
          </span>
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-lg"
        data-testid={`${testId}-popover`}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            onChange?.(toIso(day));
            setOpen(false);
          }}
          disabled={(day) => {
            if (minDate && day < minDate) return true;
            if (maxDate && day > maxDate) return true;
            return false;
          }}
          initialFocus
          className="p-3"
          classNames={{
            caption_label: "text-sm font-semibold text-slate-900",
            head_cell: "text-slate-400 rounded-md w-8 font-medium text-[0.7rem] uppercase",
            day_selected:
              "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white rounded-md",
            day_today: "bg-blue-50 text-blue-700 font-semibold",
            nav_button:
              "h-7 w-7 bg-transparent p-0 text-slate-500 opacity-70 hover:opacity-100 border border-slate-200 rounded-md",
          }}
        />
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
          <button
            type="button"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            onClick={() => {
              onChange?.("");
              setOpen(false);
            }}
            data-testid={`${testId}-clear`}
          >
            Clear
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            onClick={() => {
              onChange?.(toIso(new Date()));
              setOpen(false);
            }}
            data-testid={`${testId}-today`}
          >
            Today
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
