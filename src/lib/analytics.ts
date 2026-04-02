import * as amplitude from "@amplitude/analytics-browser";
import ReactGA from "react-ga4";

let initialized = false;

function hasGa(): boolean {
  return Boolean(import.meta.env.VITE_GA_MEASUREMENT_ID);
}

function hasAmplitude(): boolean {
  return Boolean(import.meta.env.VITE_AMPLITUDE_API_KEY);
}

/** Call once at app startup. Safe if env vars are missing (no-ops). */
export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;

  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (gaId) {
    // DebugView only shows streams with debug_mode (or GA Debugger extension).
    // Enable in dev so localhost hits appear under Admin → DebugView.
    ReactGA.initialize(gaId, {
      ...(import.meta.env.DEV ? { gtagOptions: { debug_mode: true } } : {}),
    });
  }

  const ampKey = import.meta.env.VITE_AMPLITUDE_API_KEY;
  if (ampKey) {
    amplitude.init(ampKey, {
      defaultTracking: { sessions: true, pageViews: false },
    });
  }
}

/** SPA route changes — GA4 page_view + Amplitude `page_view`. */
export function trackPageView(path: string): void {
  if (hasGa()) {
    ReactGA.send({ hitType: "pageview", page: path });
  }
  if (hasAmplitude()) {
    amplitude.track("page_view", { path });
  }
}

/**
 * Funnel + product events. Same event name is sent to GA4 (gtag) and Amplitude.
 * Params should be primitives when possible (GA4 / dashboards handle them best).
 */
export function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean | null | undefined>
): void {
  const payload = Object.fromEntries(
    Object.entries(props ?? {}).filter(([, v]) => v !== undefined && v !== null)
  ) as Record<string, string | number | boolean>;

  if (hasGa()) {
    ReactGA.event(name, payload);
  }
  if (hasAmplitude()) {
    amplitude.track(name, payload);
  }
}
