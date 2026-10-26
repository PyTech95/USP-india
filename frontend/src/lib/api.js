import axios from "axios";
import { toast } from "sonner";

export const BACKEND = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
export const api = axios.create({ baseURL: `${BACKEND}/api`, withCredentials: true });

const cookie = (n) => document.cookie.split("; ").find((c) => c.startsWith(n + "="))?.split("=")[1];

api.interceptors.request.use((cfg) => {
  const t = cookie("csrf_token");
  if (t) cfg.headers["X-CSRF-Token"] = decodeURIComponent(t);
  return cfg;
});

let refreshing = null;
api.interceptors.response.use(
  (r) => {
    if (r.headers["x-content-release-state"] === "pending") toast.warning("Saved here, but republish preparation is pending. Retry it in Import / Export.", { id: "content-release-pending" });
    return r;
  },
  async (err) => {
    const cfg = err.config || {};
    if (err.response?.status === 401 && !cfg._retry && !String(cfg.url).includes("/auth/")) {
      cfg._retry = true;
      refreshing = refreshing || api.post("/auth/refresh").finally(() => (refreshing = null));
      try {
        await refreshing;
        return api(cfg);
      } catch (e) {
        if (e.response?.status === 401) window.dispatchEvent(new Event("usp-session-expired"));
      }
    }
    return Promise.reject(err);
  }
);

export function errMsg(e) {
  const d = e?.response?.data?.detail;
  const status = e?.response?.status;
  // messages the web server (not the website) sends back: say what they mean
  if (d == null && status === 413) return "This file is too large for the server. Please use a photo under 20 MB.";
  if (d == null && [502, 503, 504].includes(status)) return "The website server is not answering right now. Please try again in a minute.";
  if (!e?.response && e?.request) return "Could not reach the website. Check the internet connection and try again.";
  if (d == null) return e?.message || "Something went wrong. Please try again.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => `${(x.loc || []).slice(-1)[0] || ""}: ${x.msg}`).join(" ");
  return String(d.msg || d);
}

// Photos are checked before they are sent, so a too-large file does not upload for minutes and then fail.
export const MAX_UPLOAD_MB = 20;
export function uploadProblem(file) {
  if (!file) return "No file was chosen.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `${file.name} is ${(file.size / 1048576).toFixed(1)} MB. Photos can be up to ${MAX_UPLOAD_MB} MB — please use a smaller copy.`;
  return "";
}

export const media = (path) => (path ? `${BACKEND}${path}` : "");
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");
