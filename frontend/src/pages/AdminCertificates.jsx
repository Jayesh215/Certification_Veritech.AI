import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, Download } from "lucide-react";
import { api, API_BASE } from "../lib/api";

const StatusBadge = ({ s }) => {
  const map = {
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Generated: "bg-blue-50 text-blue-700 border-blue-200",
    Issued: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${map[s] || map.Pending}`}>{s || "Pending"}</span>;
};

export default function AdminCertificates() {
  const [rows, setRows] = useState([]);

  const load = async () => {
    const { data } = await api.get("/admin/registrations", { params: { payment_status: "PAID" } });
    setRows(data);
  };
  useEffect(() => { load(); }, []);

  async function generate(id) {
    try {
      await api.post(`/admin/certificates/${id}/generate`);
      toast.success("Certificate generated");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not generate");
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Certificates</h1>
        <p className="mt-1 text-sm text-slate-500">Generate and dispatch certificates for paid registrations.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Reg. ID</th>
                <th className="text-left px-4 py-3 font-semibold">Intern</th>
                <th className="text-left px-4 py-3 font-semibold">Internship</th>
                <th className="text-left px-4 py-3 font-semibold">Duration</th>
                <th className="text-left px-4 py-3 font-semibold">Certificate No.</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.registration_id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-mono-tabular text-xs font-semibold">{r.registration_id}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{r.full_name}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.internship_type}</td>
                  <td className="px-4 py-3">{r.duration_months}M</td>
                  <td className="px-4 py-3 font-mono-tabular text-xs">{r.certificate_number || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge s={r.certificate_status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {r.certificate_status === "Pending" ? (
                        <button
                          onClick={() => generate(r.registration_id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                          data-testid={`generate-cert-${r.registration_id}`}
                        ><Award className="h-3 w-3" /> Generate</button>
                      ) : null}
                      <a
                        href={`${API_BASE}/certificates/${r.registration_id}/download`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:border-slate-300"
                      ><Download className="h-3 w-3" /> Download</a>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-500">No paid registrations yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
