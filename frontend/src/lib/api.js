import axios from "axios";

function resolveBackendUrl() {
  const configured = process.env.REACT_APP_BACKEND_URL || "";
  // Prefer IPv4 — on Windows, "localhost" often resolves to ::1 while the API binds 127.0.0.1
  const toIpv4 = (url) => (url || "").replace("://localhost:", "://127.0.0.1:");
  if (typeof window === "undefined") return toIpv4(configured) || configured;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return toIpv4(configured) || `${window.location.protocol}//127.0.0.1:8000`;
  }
  return `${window.location.protocol}//${host}:8000`;
}

const BACKEND_URL = resolveBackendUrl();
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export function setAdminToken(token) {
  if (token) {
    localStorage.setItem("veritech_admin_token", token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem("veritech_admin_token");
    delete api.defaults.headers.common.Authorization;
  }
}

const existing = typeof window !== "undefined" ? localStorage.getItem("veritech_admin_token") : null;
if (existing) api.defaults.headers.common.Authorization = `Bearer ${existing}`;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error?.config?.url || "";
    if (
      error?.response?.status === 401 &&
      url.includes("/admin/") &&
      !url.includes("/admin/login") &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/admin/login")
    ) {
      setAdminToken(null);
      window.location.assign("/admin/login");
    }
    return Promise.reject(error);
  }
);

export const formatCurrency = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN")}`;

// 0 → "1 Day", 1 → "1 Month", 3 → "3 Months"
export const formatDuration = (m) => {
  const n = Number(m);
  if (n === 0) return "1 Day";
  return `${n} Month${n > 1 ? "s" : ""}`;
};
// Compact form for tables: "1D", "1M", "3M"
export const formatDurationShort = (m) => (Number(m) === 0 ? "1D" : `${m}M`);

export function formatDateLabel(value) {
  const raw = String(value || "").slice(0, 10);
  if (!raw) return "";
  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateRange(start, end) {
  const from = formatDateLabel(start);
  const to = formatDateLabel(end);
  if (!from || !to) return "";
  return `${from} – ${to}`;
}

export function durationWithDates(months, start, end) {
  const label = formatDuration(months);
  const range = formatDateRange(start, end);
  return range ? `${label} · ${range}` : label;
}

export function datesFor(periods, months, record) {
  const slot = periods?.[String(months)] || {};
  return {
    start: record?.internship_start_date || slot.start_date || "",
    end: record?.internship_end_date || slot.end_date || "",
  };
}

const PUBLIC_SITE = "https://www.veritech-ai.com";

function certificatePageOrigin() {
  if (typeof window === "undefined") return PUBLIC_SITE;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return PUBLIC_SITE;
  return window.location.origin;
}

export function linkedInCertificationUrl(reg) {
  const certId = String(reg?.certificate_number || "").trim();
  if (!certId) return "";
  const issued = reg.certificate_generated_at || reg.paid_at || "";
  const parsed = issued ? new Date(issued) : null;
  const valid = parsed && !Number.isNaN(parsed.getTime());
  const role = String(reg.internship_type || "").trim();
  const name = role ? `${role} Internship` : (reg.certificate_type || "Internship Certificate");
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name,
    organizationName: "Veritech.AI",
    certUrl: `${certificatePageOrigin()}/verify/${encodeURIComponent(certId)}`,
    certId,
  });
  if (valid) {
    params.set("issueYear", String(parsed.getFullYear()));
    params.set("issueMonth", String(parsed.getMonth() + 1));
  }
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

// Perks shown on pricing cards. Keyed by duration_months.
// 3M and 6M get the strongest career-value messaging.
export const PLAN_PERKS = {
  0: [
    "Instant express certificate",
    "Downloadable PDF with verification QR",
    "Shareable on LinkedIn & resumes",
  ],
  1: [
    "Official Veritech.AI certificate",
    "LinkedIn-ready credential",
    "Public QR-based verification page",
  ],
  2: [
    "Official Veritech.AI certificate",
    "LinkedIn-ready credential",
    "Public QR-based verification page",
    "Extended internship record on your profile",
    "Highlight your internship duration",
  ],
  3: [
    "Official Veritech.AI certificate",
    "LinkedIn-ready credential",
    "Public QR-based verification page",
    "Consider as a valid internship",
    "Resume highlights",
    "Industry internship experience",
    "Recognised by hiring teams at major tech companies",
  ],
  6: [
    "Official Veritech.AI certificate",
    "LinkedIn-ready credential",
    "Public QR-based verification page",
    "Consider professional experience",
    "Consider as a valid industry-level internship",
    "Resume highlights",
    "This internship letter counts as your professional experience",
    "Recognised by hiring teams at major tech companies",
  ],
};

// Side-by-side comparison matrix. Each feature is tagged with the duration_months it ships in.
export const COMPARISON_FEATURES = [
  { label: "Official Veritech.AI certificate", in: [0, 1, 2, 3, 6] },
  { label: "LinkedIn-ready credential", in: [0, 1, 2, 3, 6] },
  { label: "Public QR-based verification page", in: [0, 1, 2, 3, 6] },
  { label: "Extended internship record on your profile", in: [2] },
  { label: "Highlight your internship duration", in: [2] },
  { label: "Consider as a valid internship", in: [3] },
  { label: "Resume highlights", in: [3, 6] },
  { label: "Industry internship experience", in: [3] },
  { label: "Recognised by hiring teams at major tech companies", in: [3, 6] },
  { label: "Consider professional experience", in: [6] },
  { label: "Consider as a valid industry-level internship", in: [6] },
  { label: "This internship letter counts as your professional experience", in: [6] },
];
