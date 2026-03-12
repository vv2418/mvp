import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { AnimatePresence, motion, animate } from "framer-motion";
import SwipeCard from "@/components/SwipeCard";
import AppShell from "@/components/AppShell";
import { MOCK_EVENTS } from "@/data/mockEvents";
import { supabase } from "@/integrations/supabase/client";
import { Flame, X, Heart } from "lucide-react";
import { toast } from "sonner";

/** Map event tag → interest id for matching */
const TAG_TO_INTEREST: Record<string, string> = {
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
};

const Feed = () => {
  const userInterests: string[] = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("rekindle_interests") || "[]");
    } catch {
      return [];
    }
  }, []);

  const sortedEvents = useMemo(() => {
    if (userInterests.length === 0) return MOCK_EVENTS;
    const interestSet = new Set(userInterests);
    return [...MOCK_EVENTS].sort((a, b) => {
      const scoreA = a.tags.filter((t) => interestSet.has(TAG_TO_INTEREST[t] || t.toLowerCase())).length;
      const scoreB = b.tags.filter((t) => interestSet.has(TAG_TO_INTEREST[t] || t.toLowerCase())).length;
      return scoreB - scoreA;
    });
  }, [userInterests]);

  const [swipeCounts, setSwipeCounts] = useState<Record<string, number>>({});
  const [events, setEvents] = useState(sortedEvents);

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
        // Trigger matchmaking
        supabase.functions.invoke("matchmaking", {
          body: { event_titles: { [event.id]: event.title } },
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
      <div className="relative flex flex-1 flex-col bg-background overflow-hidden">
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
                <p className="text-[11px] text-muted-foreground">{events.length} events near you</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card deck area */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-3 py-3">
          {events.length > 0 ? (
            <>
              {/* Card container */}
              <div className="relative w-full max-w-[520px] aspect-[3/5] sm:aspect-[3/4.5]">
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
