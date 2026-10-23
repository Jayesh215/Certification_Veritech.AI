import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, ChevronDown, Loader2, Star } from "lucide-react";
import { useRegistration } from "../context/RegistrationContext";
import { api, formatDateRange } from "../lib/api";
import useInternshipPeriods from "../lib/useInternshipPeriods";

const CERTIFICATE_TYPE = "Internship Completion Certificate";
const YEARS = ["2026", "2027", "2028", "2029", "2030", "Other"];
const DURATIONS = [0, 1, 2, 3, 6];
const durationLabel = (months) =>
  months === 0 ? "1 Day Certificate" : `${months} Month${months > 1 ? "s" : ""} Certificate`;
const isCareerDuration = (months) => months === 3 || months === 6;

const emptyForm = {
  full_name: "", email: "", mobile: "",
  college: "", course: "", branch: "", graduation_year: "",
  internship_type: "", internship_start_date: "", internship_end_date: "",
  internship_id_input: "",
  certificate_type: CERTIFICATE_TYPE,
  duration_months: 3,
  declaration_accepted: false,
};

function Field({ label, required, children, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl border border-transparent bg-[#f6f7fb] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none";

function ThemeSelect({ value, onChange, placeholder, options, testId }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-testid={testId}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`${inputCls} flex items-center justify-between gap-3 text-left ${open ? "border-blue-500 bg-white" : ""} ${selected ? "" : "text-slate-400"}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium ${
                    active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-[#f6f7fb]"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Register() {
  const periods = useInternshipPeriods();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, update } = useRegistration();
  const [form, setForm] = useState(() => {
    const next = { ...emptyForm, ...(state.form || {}), certificate_type: CERTIFICATE_TYPE };
    if (!DURATIONS.includes(next.duration_months)) next.duration_months = 3;
    return next;
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [domains, setDomains] = useState([]);

  useEffect(() => {
    api.get("/internship-domains")
      .then((r) => setDomains(Array.isArray(r.data?.domains) ? r.data.domains : []))
      .catch(() => setDomains([]));
  }, []);

  useEffect(() => {
    const internId = params.get("intern") || state.internIdFromLink;
    if (internId && !form.internship_id_input) {
      setForm((f) => ({ ...f, internship_id_input: internId }));
      update({ internIdFromLink: internId });
    }
  }, []); // eslint-disable-line

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    const e = {};
    if (!form.full_name.trim() || form.full_name.trim().length < 2) e.full_name = "Please enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Please enter a valid email address.";
    if (!/^[0-9+\-\s]{10,15}$/.test(form.mobile)) e.mobile = "Please enter a valid mobile number.";
    if (!form.internship_type) e.internship_type = "Please select your internship type.";
    if (form.duration_months === "" || form.duration_months === null || form.duration_months === undefined) e.duration_months = "Please select certificate duration.";
    if (!form.declaration_accepted) e.declaration_accepted = "Please accept the declaration.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/registrations", form);
      update({ form, registration: data });
      toast.success("Details saved");
      navigate("/review");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? (detail[0]?.msg || "Could not save details")
        : (typeof detail === "string" ? detail : null);
      toast.error(err?.response ? (message || "Could not save details") : "Cannot reach the server. Start the API on port 8000 and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-6">
      <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Certificate registration
        </h1>
        <p className="mt-1 text-sm text-slate-500">Enter the details that should appear on your certificate.</p>
      </section>

      <div className="mt-4 rounded-[28px] bg-white shadow-sm">
        {/* Section: Personal */}
        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">01 · Personal Information</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Intern Details</h2>
          <p className="mt-1 text-sm text-slate-500">Please enter your details exactly as they should appear on the certificate.</p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Full Name" required error={errors.full_name}>
              <input data-testid="intern-name-input" className={inputCls} placeholder="Enter your full name"
                value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </Field>
            <Field label="Email Address" required error={errors.email}>
              <input data-testid="intern-email-input" type="email" className={inputCls} placeholder="Enter your email address"
                value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Mobile Number" required error={errors.mobile}>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-2xl bg-[#f6f7fb] px-3 text-sm font-semibold text-slate-600">+91</span>
                <input data-testid="intern-phone-input" className={inputCls} placeholder="10-digit mobile number"
                  value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
              </div>
            </Field>
            <Field label="College / University">
              <input data-testid="intern-college-input" className={inputCls} placeholder="Your college or university"
                value={form.college} onChange={(e) => set("college", e.target.value)} />
            </Field>
            <Field label="Course / Degree">
              <input className={inputCls} placeholder="e.g., B.Tech / BCA / MCA"
                value={form.course} onChange={(e) => set("course", e.target.value)} />
            </Field>
            <Field label="Branch / Specialization">
              <input className={inputCls} placeholder="e.g., Computer Science"
                value={form.branch} onChange={(e) => set("branch", e.target.value)} />
            </Field>
            <Field label="Graduation Year">
              <ThemeSelect
                value={form.graduation_year}
                onChange={(value) => set("graduation_year", value)}
                placeholder="Select year"
                options={YEARS.map((year) => ({ value: year, label: year }))}
                testId="graduation-year-select"
              />
            </Field>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Section: Internship */}
        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">02 · Internship Information</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Internship Details</h2>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Internship Type" required error={errors.internship_type}>
              <ThemeSelect
                value={form.internship_type}
                onChange={(value) => set("internship_type", value)}
                placeholder="Select Internship Type"
                options={domains.map((domain) => ({ value: domain, label: domain }))}
                testId="intern-domain-select"
              />
            </Field>
            <Field label="Internship ID / Registration ID">
              <input
                className={inputCls}
                placeholder="Optional — if you have a link ID"
                value={form.internship_id_input}
                onChange={(e) => set("internship_id_input", e.target.value)}
                readOnly={!!state.internIdFromLink}
              />
            </Field>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Section: Certificate */}
        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">03 · Certificate Information</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Certificate Preferences</h2>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <Field label="Certificate Duration" required error={errors.duration_months}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DURATIONS.map((m) => {
                    const selected = form.duration_months === m;
                    const career = isCareerDuration(m);
                    return (
                      <button
                        type="button"
                        key={m}
                        onClick={() => set("duration_months", m)}
                        data-testid={`duration-pill-${m}m`}
                        className={`relative rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                          selected
                            ? "bg-blue-600 text-white"
                            : career
                              ? "border border-blue-200 bg-blue-50/70 text-slate-800 hover:border-blue-300"
                              : "bg-[#f6f7fb] text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {career && (
                          <span
                            className={`absolute -top-2 right-3 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              selected
                                ? "bg-white/20 text-white"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            <Star className={`h-2.5 w-2.5 ${selected ? "fill-white text-white" : "fill-emerald-500 text-emerald-600"}`} />
                            Career
                          </span>
                        )}
                        <span className="block">{durationLabel(m)}</span>
                        {formatDateRange(periods[String(m)]?.start_date, periods[String(m)]?.end_date) && (
                          <span className={`mt-0.5 block text-xs font-medium ${selected ? "text-blue-100" : "text-slate-500"}`}>
                            {formatDateRange(periods[String(m)]?.start_date, periods[String(m)]?.end_date)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-[20px] bg-[#f6f7fb] p-4">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={form.declaration_accepted}
              onChange={(e) => set("declaration_accepted", e.target.checked)}
              data-testid="intern-declaration-checkbox"
            />
            <span className="text-sm text-slate-700 leading-relaxed">
              I confirm that the information provided above is accurate and should be used for generating my Veritech.AI certificate.
            </span>
          </label>
          {errors.declaration_accepted && (
            <p className="mt-1 text-xs text-red-600">{errors.declaration_accepted}</p>
          )}
        </div>

        <div className="flex flex-col items-stretch justify-between gap-3 bg-[#f6f7fb] px-6 py-4 sm:flex-row sm:items-center sm:px-8 sm:py-5">
          <p className="text-xs text-slate-500">Secure · Simple · Official Veritech.AI Portal</p>
          <button
            onClick={submit}
            disabled={saving || !form.declaration_accepted}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="registration-continue-btn"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Continue to Review
          </button>
        </div>
      </div>
    </div>
  );
}
