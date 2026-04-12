import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, MapPin } from "lucide-react";

interface LikedEvent {
  id: string;
  title: string;
  date: string; // e.g. "Apr 9", "Mar 15"
  location: string;
  image: string;
}

/** Parse a "Mon DD" string into a Date in the current year */
function parseEventDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === "TBA") return null;
  const d = new Date(`${dateStr}, ${new Date().getFullYear()}`);
  return isNaN(d.getTime()) ? null : d;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const EventCalendar = () => {
  useRequireAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const likedEvents: LikedEvent[] = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("rekindle_liked_events") || "[]");
    } catch {
      return [];
    }
  }, []);

  // Map each event to its parsed date
  const eventsWithDates = useMemo(() => {
    return likedEvents
      .map((e) => ({ ...e, parsed: parseEventDate(e.date) }))
      .filter((e): e is LikedEvent & { parsed: Date } => e.parsed !== null);
  }, [likedEvents]);

  // Dates that have events (for dot indicators)
  const eventDates = useMemo(() => {
    const dates: Date[] = [];
    const seen = new Set<string>();
    for (const e of eventsWithDates) {
      const key = e.parsed.toDateString();
      if (!seen.has(key)) {
        seen.add(key);
        dates.push(e.parsed);
      }
    }
    return dates;
  }, [eventsWithDates]);

  // Events for the selected date
  const eventsForDate = useMemo(() => {
    return eventsWithDates.filter((e) => sameDay(e.parsed, selectedDate));
  }, [eventsWithDates, selectedDate]);

  return (
    <AppShell>
      <div className="flex flex-1 flex-col bg-background overflow-hidden min-h-0">
        {/* Header */}
        <div className="relative z-20 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10">
                <CalendarDays className="h-4 w-4 text-accent" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold">Calendar</h1>
                <p className="text-[11px] text-muted-foreground">
                  {likedEvents.length === 0
                    ? "Like events to see them here"
                    : `${likedEvents.length} liked event${likedEvents.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
          <div className="mx-auto max-w-lg">
            {/* Calendar */}
            <div className="flex justify-center px-4 pt-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                modifiers={{ hasEvent: eventDates }}
                modifiersClassNames={{ hasEvent: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-accent" }}
                className="rounded-2xl border border-border bg-card/50 p-4"
              />
            </div>

            {/* Events for selected date */}
            <div className="px-6 pt-5 pb-4">
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em] mb-3">
                {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </h2>

              <AnimatePresence mode="wait">
                {eventsForDate.length > 0 ? (
                  <motion.div
                    key={selectedDate.toDateString()}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {eventsForDate.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/50 p-3 transition-colors hover:bg-card"
                      >
                        <img
                          src={event.image}
                          alt={event.title}
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-[15px] truncate">{event.title}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {event.location}
                          </p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-muted-foreground text-center py-8"
                  >
                    No liked events on this date
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default EventCalendar;
