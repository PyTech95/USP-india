import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { BACKEND } from "./api";
import { useAuth } from "./auth";

// Cookie-free page-view counter for the admin Traffic dashboard.
// Skips editors (logged in), private previews and the live-editor preview frame.
export function usePageTracking(preview) {
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const first = useRef(true);
  useEffect(() => {
    if (preview || user !== false || pathname.startsWith("/admin")) return;
    const params = new URLSearchParams(search);
    if (params.has("editor-preview")) return;
    const body = {
      path: pathname,
      ref: first.current ? document.referrer || "" : "",
      w: window.innerWidth || 0,
      tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })(),
      utm_source: first.current ? params.get("utm_source") || "" : "",
      utm_medium: first.current ? params.get("utm_medium") || "" : "",
      utm_campaign: first.current ? params.get("utm_campaign") || "" : "",
    };
    first.current = false;
    try {
      fetch(`${BACKEND}/api/public/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true, credentials: "omit" }).catch(() => {});
    } catch { /* never break the page for statistics */ }
  }, [pathname, user, preview]); // eslint-disable-line react-hooks/exhaustive-deps
}
