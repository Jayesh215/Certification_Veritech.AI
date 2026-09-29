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
