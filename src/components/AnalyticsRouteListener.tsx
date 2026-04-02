import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

/** Sends a virtual page view on client-side navigation (SPA). */
export function AnalyticsRouteListener() {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    trackPageView(path);
  }, [location.pathname, location.search]);

  return null;
}
