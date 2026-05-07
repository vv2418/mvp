import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, ShieldAlert, X } from "lucide-react";
import type { EventData, EventSource } from "@/components/EventCard";
import { trackEvent } from "@/lib/analytics";

interface ExternalEventLinkDialogProps {
  event: EventData | null;
  open: boolean;
  onClose: () => void;
}

const SKIP_KEY = "rekindle_skip_external_disclaimer";

function platformLabel(source?: EventSource): string {
  if (source === "ticketmaster") return "Ticketmaster";
  if (source === "eventbrite") return "Eventbrite";
  return "the host platform";
}

function platformDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function inferSource(event: EventData): EventSource | undefined {
  if (event.source) return event.source;
  if (!event.url) return undefined;
  const host = platformDomain(event.url).toLowerCase();
  if (host.includes("ticketmaster")) return "ticketmaster";
  if (host.includes("eventbrite")) return "eventbrite";
  return "other";
}

function openExternalLink(url: string) {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) win.opener = null;
}

const ExternalEventLinkDialog = ({ event, open, onClose }: ExternalEventLinkDialogProps) => {
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (open) setDontShow(false);
  }, [open]);

  const source = useMemo(() => (event ? inferSource(event) : undefined), [event]);
  const platform = platformLabel(source);
  const domain = event?.url ? platformDomain(event.url) : "";

  if (!event || !event.url) return null;

  const handleContinue = () => {
    if (!event.url) return;
    if (dontShow) {
      try {
        sessionStorage.setItem(SKIP_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    trackEvent("external_event_link_open", {
      event_id: event.id,
      source: source ?? "unknown",
      domain,
    });
    openExternalLink(event.url);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="external-link-title"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl border border-border"
            >
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <ShieldAlert className="h-5 w-5 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="external-link-title"
                      className="font-display text-lg font-semibold text-foreground leading-tight"
                    >
                      You're leaving Rekindle
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Continuing to {platform}
                      {domain ? ` · ${domain}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 pb-1">
                <div className="rounded-xl bg-secondary/60 border border-border/60 px-4 py-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Event
                  </p>
                  <p className="text-sm font-semibold text-foreground line-clamp-2">{event.title}</p>
                  {event.date || event.location ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      {[event.date, event.location].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
              </div>

              <ul className="px-6 py-4 space-y-2.5 text-sm text-foreground/90">
                <DisclaimerItem>
                  Tickets must be purchased on <strong>{platform}</strong>. Rekindle does not
                  process payments or sell tickets.
                </DisclaimerItem>
                <DisclaimerItem>
                  Rekindle is <strong>not affiliated with, endorsed by, or sponsored by</strong>{" "}
                  {platform}. We don't earn commissions on any ticket purchases.
                </DisclaimerItem>
                <DisclaimerItem>
                  Event details, pricing, availability, and any changes are managed entirely by{" "}
                  {platform} and may differ from what's shown here.
                </DisclaimerItem>
                <DisclaimerItem>
                  For refunds, support, or ticket issues, contact {platform} directly — Rekindle
                  cannot help with platform-side problems.
                </DisclaimerItem>
                <DisclaimerItem>
                  Always verify the listing and seller before completing a purchase.
                </DisclaimerItem>
              </ul>

              <label className="flex items-center gap-2 px-6 pb-3 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dontShow}
                  onChange={(e) => setDontShow(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-accent"
                />
                Don't show this again for this session
              </label>

              <div className="flex items-center gap-2 px-6 pb-6 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(232,71,10,0.28)] hover:bg-accent/90 transition-colors"
                >
                  Continue
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

const DisclaimerItem = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-2.5">
    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" aria-hidden="true" />
    <span className="text-[13px] leading-relaxed text-foreground/85">{children}</span>
  </li>
);

/**
 * Open an external event link, showing the disclaimer first unless the user
 * has dismissed it for this session. Returns `true` if the link was opened
 * directly (no dialog needed) so callers can decide what to do.
 */
export function shouldShowExternalDisclaimer(): boolean {
  try {
    return sessionStorage.getItem(SKIP_KEY) !== "1";
  } catch {
    return true;
  }
}

export function openExternalEventLinkDirect(event: EventData): void {
  if (!event.url) return;
  const source = inferSource(event);
  trackEvent("external_event_link_open", {
    event_id: event.id,
    source: source ?? "unknown",
    domain: platformDomain(event.url),
    skipped_disclaimer: true,
  });
  openExternalLink(event.url);
}

export default ExternalEventLinkDialog;
