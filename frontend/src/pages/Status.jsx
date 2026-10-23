import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Loader2, Download, ArrowRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AddToLinkedIn from "../components/AddToLinkedIn";
import { api, API_BASE, datesFor, durationWithDates } from "../lib/api";
import useInternshipPeriods from "../lib/useInternshipPeriods";
import { StatusResultSkeleton } from "../components/PageSkeletons";

const STATUS_TONE = {
  PAID: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-rose-50 text-rose-700",
  REFUNDED: "bg-slate-100 text-slate-600",
};

export default function Status() {
  const periods = useInternshipPeriods();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [reg, setReg] = useState(null);
  const [loading, setLoading] = useState(false);

  async function lookupQuery(query) {
    const value = (query || "").trim();
    if (!value) return;
    setLoading(true);
    setReg(null);
    try {
      const { data } = await api.get("/registrations/status/lookup", { params: { query: value } });
      setReg(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Not found");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const initial = params.get("q");
    if (initial) lookupQuery(initial);
    // Run once for the link in the confirmation email.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function lookup(e) {
    e.preventDefault();
    lookupQuery(q);
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-6">
      <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Application tracker</h1>
        <p className="mt-1 text-sm text-slate-500">Look up a certificate by registration ID, certificate ID, or email.</p>

        <form onSubmit={lookup} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-[#f6f7fb] px-4 py-2.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Registration ID, certificate ID, or email"
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              data-testid="status-query-input"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="status-check-btn"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Check status
          </button>
        </form>
      </section>

      {loading && !reg && <StatusResultSkeleton />}

      {reg && (
        <section className="mt-4 rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold text-slate-400">Registration ID</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{reg.registration_id}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[reg.payment_status] || STATUS_TONE.PENDING}`}>
              {reg.payment_status}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label="Name" value={reg.full_name} />
            <Info label="Email" value={reg.email} />
            <Info label="Internship" value={reg.internship_type} />
            <Info label="Certificate ID" value={reg.certificate_number || "Not issued yet"} />
            <Info label="Certificate" value={reg.certificate_type} />
            <Info label="Duration" value={durationWithDates(reg.duration_months, datesFor(periods, reg.duration_months, reg).start, datesFor(periods, reg.duration_months, reg).end)} />
            <Info label="Certificate status" value={reg.certificate_status} />
            <Info label="Registered on" value={reg.created_at?.slice(0, 10)} />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {reg.payment_status === "PAID" ? (
              <>
                <a
                  href={`${API_BASE}/certificates/${reg.registration_id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  data-testid="status-download-certificate-btn"
                >
                  <Download className="h-4 w-4" /> Download certificate
                </a>
                <AddToLinkedIn registration={reg} className="rounded-full px-5 py-2.5" />
              </>
            ) : (
              <Link
                to="/payment"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                data-testid="status-complete-payment-btn"
              >
                Complete payment <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl bg-[#f6f7fb] px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value || "—"}</p>
    </div>
  );
}
