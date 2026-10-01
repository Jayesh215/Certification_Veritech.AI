import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
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
    "Everything in 1-Month plan",
    "Extended internship record on your profile",
    "Priority email support",
  ],
  3: [
    "Counts as professional work experience",
    "Recognised by hiring teams at major tech companies",
    "Signed Letter of Recommendation on request",
    "LinkedIn, resume & portfolio ready",
    "Priority mentor support",
  ],
  6: [
    "Full industry-grade internship experience",
    "Weighted higher during top-tier resume screening",
    "Signed Letter of Recommendation included",
    "Featured on the Veritech.AI alumni directory",
    "1-on-1 career guidance call with a mentor",
  ],
};

// Side-by-side comparison matrix. Each feature is tagged with the duration_months it ships in.
export const COMPARISON_FEATURES = [
  { label: "Official Veritech.AI certificate", in: [0, 1, 2, 3, 6] },
  { label: "Downloadable PDF with QR verification", in: [0, 1, 2, 3, 6] },
  { label: "LinkedIn-ready credential", in: [0, 1, 2, 3, 6] },
  { label: "Public verification page", in: [0, 1, 2, 3, 6] },
  { label: "Extended internship record on profile", in: [2, 3, 6] },
  { label: "Priority email support", in: [2, 3, 6] },
  { label: "Counts as professional work experience", in: [3, 6] },
  { label: "Recognised by hiring teams at major tech companies", in: [3, 6] },
  { label: "Signed Letter of Recommendation", in: [3, 6] },
  { label: "Portfolio-ready credential", in: [3, 6] },
  { label: "Priority mentor support", in: [3, 6] },
  { label: "Full industry-grade internship experience", in: [6] },
  { label: "Weighted higher in top-tier resume screening", in: [6] },
  { label: "Featured on Veritech.AI alumni directory", in: [6] },
  { label: "1-on-1 career guidance call", in: [6] },
];
