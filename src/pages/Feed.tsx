import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { AnimatePresence, motion, animate } from "framer-motion";
import SwipeCard from "@/components/SwipeCard";
import AppShell from "@/components/AppShell";
import { MOCK_EVENTS } from "@/data/mockEvents";
import { fetchTicketmasterEvents } from "@/lib/ticketmaster";
import { EventData } from "@/components/EventCard";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { Flame, X, Heart, MapPin } from "lucide-react";
import { toast } from "sonner";

/** Map event tag → interest id for matching */
const TAG_TO_INTEREST: Record<string, string> = {
  // Mock event tags
  "Music": "music", "Live": "music",
  "Tech": "tech", "Coding": "tech", "Competition": "tech",
  "Networking": "networking", "Startups": "startups",
  "Food": "food", "Festival": "food", "Brunch": "food",
  "Fitness": "fitness", "Outdoors": "outdoors",
  "Wellness": "fitness",
  "Art": "art", "Culture": "art",
  "Comedy": "comedy", "Entertainment": "comedy",
  "Night Out": "dance", "Dance": "dance",
  "Social": "networking",
  "Games": "gaming", "Casual": "gaming",
  "Film": "movies", "Chill": "outdoors",
  // Ticketmaster segments
  "Arts & Theatre": "art",
  "Film, TV & Radio": "movies",
  "Miscellaneous": "networking",
  // Ticketmaster genres — Music
  "Rock": "music", "Pop": "music", "Hip-Hop": "music", "Hip-Hop/Rap": "music",
  "R&B": "music", "Classical": "music", "Country": "music", "Jazz": "music",
  "Blues": "music", "Electronic": "music", "Dance/Electronic": "music",
  "Latin": "music", "Reggae": "music", "Folk": "music", "Alternative": "music",
  "Metal": "music", "Punk": "music", "Soul": "music", "Gospel": "music",
  "World": "music", "Opera": "art",
  // Ticketmaster genres — Sports
  "Sports": "sports", "Football": "sports", "Basketball": "sports",
  "Baseball": "sports", "Soccer": "sports", "Hockey": "sports",
  "Tennis": "sports", "Golf": "sports", "Boxing": "sports",
  "MMA": "sports", "Wrestling": "sports", "Motorsports/Racing": "sports",
  "Volleyball": "sports", "Softball": "sports",
  // Ticketmaster genres — Arts
  "Theatre": "art", "Musical": "art", "Dance": "dance", "Ballet": "dance",
  "Broadway": "art", "Circus": "art", "Magic": "art",
  // Ticketmaster genres — Other
  "Comedy": "comedy", "Stand-Up": "comedy",
  "Technology": "tech", "Science": "tech",
  "Food & Drink": "food", "Beer & Wine": "food",
  "Outdoor": "outdoors", "Nature": "outdoors", "Adventure": "outdoors",
  "Family": "networking", "Children's Festival": "food",
  "Gaming": "gaming", "Esports": "gaming",
  "Film": "movies", "Screening": "movies",
  "Fitness": "fitness", "Health": "fitness", "Yoga": "fitness",
  "Running": "fitness", "Cycling": "fitness",
};

const Feed = () => {
  useEffect(() => {
    trackEvent("onboarding_activation");
  }, []);

  const userInterests: string[] = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("rekindle_interests") || "[]");
    } catch {
      return [];
    }
  }, []);

  const sortEvents = useCallback((rawEvents: EventData[]) => {
    if (userInterests.length === 0) return rawEvents;
    const interestSet = new Set(userInterests);
    return [...rawEvents].sort((a, b) => {
      const scoreA = a.tags.filter((t) => interestSet.has(TAG_TO_INTEREST[t] || t.toLowerCase())).length;
      const scoreB = b.tags.filter((t) => interestSet.has(TAG_TO_INTEREST[t] || t.toLowerCase())).length;
      return scoreB - scoreA;
    });
  }, [userInterests]);

  const [swipeCounts, setSwipeCounts] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<EventData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [needsCity, setNeedsCity] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const eventTitlesRef = useRef<Record<string, string>>({});

  const loadEvents = useCallback(async (options: { lat?: number; lng?: number; city?: string } = {}) => {
    setLoadingEvents(true);
    try {
      const tmEvents = await fetchTicketmasterEvents({ ...options, size: 20 });
      const finalEvents = tmEvents.length > 0 ? tmEvents : MOCK_EVENTS;
      for (const e of finalEvents) eventTitlesRef.current[e.id] = e.title;
      setEvents(sortEvents(finalEvents));
      setNeedsCity(false);
    } catch {
      for (const e of MOCK_EVENTS) eventTitlesRef.current[e.id] = e.title;
      setEvents(sortEvents(MOCK_EVENTS));
    } finally {
      setLoadingEvents(false);
    }
  }, [sortEvents]);

  // On mount: try geolocation, fall back to city prompt
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        loadEvents({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // Denied or unavailable — ask for city
        setNeedsCity(true);
        setLoadingEvents(false);
      },
      { timeout: 6000 }
    );
  }, [loadEvents]);

  const handleCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const city = cityInput.trim();
    if (!city) return;
    loadEvents({ city });
  };

  // Fetch swipe counts AND filter out events user already swiped on
  useEffect(() => {
    const fetchData = async () => {
      const { data: allSwipes } = await supabase
        .from("swipes")
        .select("event_id")
        .eq("direction", "right");

      const counts: Record<string, number> = {};
      for (const row of allSwipes || []) {
        counts[row.event_id] = (counts[row.event_id] || 0) + 1;
      }
      setSwipeCounts(counts);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userSwipes } = await supabase
          .from("swipes")
          .select("event_id")
          .eq("user_id", user.id);

        const swipedIds = new Set((userSwipes || []).map((s) => s.event_id));
        setEvents((prev) => prev.filter((e) => !swipedIds.has(e.id)));
      }
    };
    fetchData();
  }, []);

  const handleSwipe = useCallback(
    async (direction: "left" | "right") => {
      const event = events[0];
      if (!event) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in first");
        return;
      }

      // Insert swipe
      const { error } = await supabase
        .from("swipes")
        .insert({ user_id: user.id, event_id: event.id, direction });

      if (error && error.code !== "23505") {
        toast.error("Something went wrong");
        return;
      }

      if (direction === "right") {
        if (error?.code === "23505") {
          toast.info("You already liked this!");
        } else {
          toast.success(`You're interested in "${event.title}" ❤️`);
          setSwipeCounts((prev) => ({ ...prev, [event.id]: (prev[event.id] || 0) + 1 }));
        }
        // Trigger matchmaking with all known titles so any new room gets the right name
        supabase.functions.invoke("matchmaking", {
          body: { event_titles: eventTitlesRef.current },
        }).catch(() => {});
      }

      // Remove card
      setEvents((prev) => prev.slice(1));
    },
    [events]
  );

  // Button-triggered swipes with animation
  const triggerSwipe = useCallback(
    (direction: "left" | "right") => {
      handleSwipe(direction);
    },
    [handleSwipe]
  );

  const currentEvent = events[0];

  return (
    <AppShell>
      <div className="relative flex flex-1 flex-col bg-background overflow-hidden min-h-0">
        {/* Background decorations */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 right-0 h-[600px] w-[600px] rounded-full bg-accent/[0.06] blur-[120px]" />
          <div className="absolute bottom-0 -left-40 h-[500px] w-[500px] rounded-full bg-accent/[0.04] blur-[100px]" />
        </div>

        {/* Header */}
        <div className="relative z-20 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10">
                <Flame className="h-4 w-4 text-accent" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold">Discover</h1>
                <p className="text-[11px] text-muted-foreground">
                  {loadingEvents ? "Finding events near you…" : needsCity ? "Enter your city to find events" : `${events.length} events near you`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card deck area */}
        <div className="relative z-10 flex flex-1 min-h-0 flex-col items-center justify-center px-3 py-3 pb-24 lg:pb-8">
          {loadingEvents ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 text-muted-foreground"
            >
              <div className="h-[min(62svh,720px)] w-full max-w-[520px] rounded-2xl bg-secondary animate-pulse" />
              <p className="text-sm">Loading events near you…</p>
            </motion.div>
          ) : needsCity ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center text-center px-6 w-full max-w-sm"
            >
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
                <MapPin className="h-9 w-9 text-accent" />
              </div>
              <h2 className="mb-2 font-display text-2xl font-bold">Where are you?</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Allow location or enter your city to find events near you.
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => loadEvents({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    () => toast.error("Location access denied — enter your city below"),
                    { timeout: 6000 }
                  );
                }}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition-all hover:bg-secondary active:scale-95"
              >
                <MapPin className="h-4 w-4 text-accent" />
                Use my location
              </button>
              <div className="mb-4 flex w-full items-center gap-3 text-xs text-muted-foreground">
                <div className="flex-1 border-t border-border" />
                or
                <div className="flex-1 border-t border-border" />
              </div>
              <form onSubmit={handleCitySubmit} className="flex w-full gap-2">
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="e.g. New York, Chicago, LA…"
                  className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                  autoFocus
                />
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent/90 active:scale-95"
                >
                  Go
                </button>
              </form>
            </motion.div>
          ) : events.length > 0 ? (
            <>
              {/* Card container */}
              <div className="relative w-full max-w-[520px] h-[min(62svh,720px)] sm:h-[min(68svh,760px)]">
                <AnimatePresence>
                  {events.slice(0, 3).map((event, i) => (
                    <SwipeCard
                      key={event.id}
                      event={{ ...event, attendees: swipeCounts[event.id] || event.attendees }}
                      onSwipe={handleSwipe}
                      isTop={i === 0}
                      index={i}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Action buttons — desktop only (mobile uses swipe) */}
              <div className="mt-4 hidden items-center gap-6 lg:flex">
                <button
                  onClick={() => triggerSwipe("left")}
                  className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400/30 bg-card shadow-card transition-all hover:scale-110 hover:border-red-400/60 hover:shadow-elevated active:scale-95"
                >
                  <X className="h-7 w-7 text-red-400" />
                </button>
                <button
                  onClick={() => triggerSwipe("right")}
                  className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-green-400/30 bg-accent shadow-card transition-all hover:scale-110 hover:border-green-400/60 hover:shadow-elevated active:scale-95"
                >
                  <Heart className="h-9 w-9 text-white" fill="white" />
                </button>
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center text-center px-6"
            >
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
                <Flame className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="mb-2 font-display text-2xl font-bold">No more events right now</h2>
              <p className="text-muted-foreground max-w-sm">
                Check back later for more events near you!
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default Feed;
