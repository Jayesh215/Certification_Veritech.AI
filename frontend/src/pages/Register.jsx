import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import Stepper from "../components/Stepper";
import { useRegistration } from "../context/RegistrationContext";
import { api } from "../lib/api";

const INTERNSHIP_TYPES = [
  "Web Development", "Java Development", "Python Development",
  "React.js Development", "Angular Development", "AI / Machine Learning",
  "Data Science", "UI/UX Design", "Software Testing",
  "Full Stack Development", "Other",
];
const CERT_TYPES = ["Internship Certificate", "Internship Completion Certificate", "Training Certificate", "Other"];
const YEARS = ["2026", "2027", "2028", "2029", "2030", "Other"];
const DURATIONS = [0, 1, 2, 3, 6];

const emptyForm = {
  full_name: "", email: "", mobile: "",
  college: "", course: "", branch: "", graduation_year: "",
  internship_type: "", internship_start_date: "", internship_end_date: "",
  internship_id_input: "",
  certificate_type: "Internship Certificate",
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
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 veritech-focus transition-all";

export default function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, update } = useRegistration();
  const [form, setForm] = useState(() => ({ ...emptyForm, ...(state.form || {}) }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

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
    if (!form.internship_start_date) e.internship_start_date = "Please select a start date.";
    if (!form.internship_end_date) e.internship_end_date = "Please select an end date.";
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
      toast.error(err?.response?.data?.detail || "Could not save details");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <Stepper current={1} />

      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Complete your certificate registration
        </h1>
        <p className="mt-2 text-slate-600">Submit your internship details to receive your Veritech.AI certificate.</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
                <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">+91</span>
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
              <select className={inputCls} value={form.graduation_year} onChange={(e) => set("graduation_year", e.target.value)}>
                <option value="">Select year</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
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
              <select data-testid="intern-domain-select" className={inputCls}
                value={form.internship_type} onChange={(e) => set("internship_type", e.target.value)}>
                <option value="">Select Internship Type</option>
                {INTERNSHIP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
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
            <Field label="Internship Start Date" required error={errors.internship_start_date}>
              <input data-testid="intern-start-date" type="date" className={inputCls}
                value={form.internship_start_date} onChange={(e) => set("internship_start_date", e.target.value)} />
            </Field>
            <Field label="Internship End Date" required error={errors.internship_end_date}>
              <input data-testid="intern-end-date" type="date" className={inputCls}
                value={form.internship_end_date} onChange={(e) => set("internship_end_date", e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Section: Certificate */}
        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">03 · Certificate Information</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Certificate Preferences</h2>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Certificate Type">
              <select className={inputCls} value={form.certificate_type} onChange={(e) => set("certificate_type", e.target.value)}>
                {CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Certificate Duration" required error={errors.duration_months}>
              <div className="grid grid-cols-5 gap-2">
                {DURATIONS.map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => set("duration_months", m)}
                    data-testid={`duration-pill-${m === 0 ? "1d" : m + "m"}`}
                    className={`rounded-xl border px-2.5 py-2 text-sm font-semibold transition-all ${
                      form.duration_months === m
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {m === 0 ? "1D" : `${m}M`}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <label className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 cursor-pointer">
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

        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:px-8 sm:py-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Secure · Simple · Official Veritech.AI Portal</p>
          <button
            onClick={submit}
            disabled={saving || !form.declaration_accepted}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
