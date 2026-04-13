import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SwipeCard from "@/components/SwipeCard";
import AppShell from "@/components/AppShell";
import { MOCK_EVENTS } from "@/data/mockEvents";
import { fetchTicketmasterEvents } from "@/lib/ticketmaster";
import { EventData } from "@/components/EventCard";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import {
  Flame, X, Heart, Star, MapPin, Search, Bell, Settings,
  TrendingUp, Sparkles, Users, MessageCircle, ChevronRight, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const TAG_TO_INTEREST: Record<string, string> = {
  "Music": "music", "Live": "music",
  "Tech": "tech", "Coding": "tech", "Competition": "tech",
  "Networking": "networking", "Startups": "startups",
  "Food": "food", "Festival": "food", "Brunch": "food",
  "Outdoors": "outdoors", "Wellness": "fitness",
  "Art": "art", "Culture": "art",
  "Entertainment": "comedy", "Night Out": "dance",
  "Social": "networking", "Games": "gaming", "Casual": "gaming",
  "Chill": "outdoors",
  "Arts & Theatre": "art", "Film, TV & Radio": "movies", "Miscellaneous": "networking",
  "Rock": "music", "Pop": "music", "Hip-Hop": "music", "Hip-Hop/Rap": "music",
  "R&B": "music", "Classical": "music", "Country": "music", "Jazz": "music",
  "Blues": "music", "Electronic": "music", "Dance/Electronic": "music",
  "Latin": "music", "Reggae": "music", "Folk": "music", "Alternative": "music",
  "Metal": "music", "Punk": "music", "Soul": "music", "Gospel": "music",
  "World": "music", "Opera": "art",
  "Sports": "sports", "Football": "sports", "Basketball": "sports",
  "Baseball": "sports", "Soccer": "sports", "Hockey": "sports",
  "Tennis": "sports", "Golf": "sports", "Boxing": "sports",
  "MMA": "sports", "Wrestling": "sports", "Motorsports/Racing": "sports",
  "Volleyball": "sports", "Softball": "sports",
  "Theatre": "art", "Musical": "art", "Dance": "dance", "Ballet": "dance",
  "Broadway": "art", "Circus": "art", "Magic": "art",
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

const LOCATION_STORAGE_KEY = "rekindle_last_location";

function readSavedLocation(): { lat?: number; lng?: number; city?: string } | null {
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      lat: typeof parsed.lat === "number" ? parsed.lat : undefined,
      lng: typeof parsed.lng === "number" ? parsed.lng : undefined,
      city: typeof parsed.city === "string" ? parsed.city : undefined,
    };
  } catch { return null; }
}

function saveLocation(location: { lat?: number; lng?: number; city?: string }) {
  try { localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location)); } catch { /* ignore */ }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Notification {
  roomId: string;
  eventTitle: string;
  unreadCount: number;
  lastMessageAt: string;
}

interface RecentRoom {
  roomId: string;
  eventTitle: string;
  createdAt: string;
  otherMemberName?: string;
}

const Feed = () => {
  useRequireAuth();
  const navigate = useNavigate();
  useEffect(() => { trackEvent("onboarding_activation"); }, []);

  const userInterests: string[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("rekindle_interests") || "[]"); }
    catch { return []; }
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

  // ── Core feed state ──────────────────────────────────────────────────────────
  const [swipeCounts, setSwipeCounts] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<EventData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [needsCity, setNeedsCity] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const eventTitlesRef = useRef<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<EventData[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [currentEventRoomId, setCurrentEventRoomId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const lastLocationRef = useRef<{ lat?: number; lng?: number; city?: string }>({});
  const swipedIdsRef = useRef<Set<string>>(new Set());
  const swipesLoadedRef = useRef(false);

  // ── User / stats state ───────────────────────────────────────────────────────
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [swipeCount, setSwipeCount] = useState(0);
  const [roomCount, setRoomCount] = useState(0);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [trendingModalOpen, setTrendingModalOpen] = useState(false);

  // ── Load user profile + stats ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Profile
      const { data: profile } = await supabase.from("profiles").select("name, avatar_url").eq("id", user.id).maybeSingle();
      const name = profile?.name || user.user_metadata?.name || "You";
      setUserName(name);
      setUserAvatar(profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`);

      // Swipe count
      const { count: sc } = await supabase.from("swipes").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("direction", "right");
      setSwipeCount(sc ?? 0);

      // Rooms
      const { data: myRooms } = await supabase.from("room_users").select("room_id").eq("user_id", user.id);
      const roomIds = (myRooms || []).map((r) => r.room_id);
      setRoomCount(roomIds.length);

      if (roomIds.length > 0) {
        // Recent rooms with other member name
        const { data: rooms } = await supabase.from("rooms").select("id, event_title, created_at").in("id", roomIds).order("created_at", { ascending: false }).limit(3);
        const withMembers = await Promise.all((rooms || []).map(async (room) => {
          const { data: others } = await supabase.from("room_users").select("user_id").eq("room_id", room.id).neq("user_id", user.id).limit(1);
          let otherMemberName: string | undefined;
          if (others?.[0]) {
            const { data: p } = await supabase.from("profiles").select("name").eq("id", others[0].user_id).maybeSingle();
            otherMemberName = p?.name;
          }
          return { roomId: room.id, eventTitle: room.event_title || "Event", createdAt: room.created_at, otherMemberName };
        }));
        setRecentRooms(withMembers);

        // Unread notifications
        const notifs: Notification[] = [];
        for (const membership of (myRooms || [])) {
          const { data: roomData } = await supabase.from("rooms").select("event_title").eq("id", membership.room_id).maybeSingle();
          const { data: ruData } = await (supabase.from("room_users") as unknown as { select: (c: string) => { eq: (a: string, b: string) => { eq: (a: string, b: string) => Promise<{ data: { last_read_at: string } | null }> } } })
            .select("last_read_at").eq("room_id", membership.room_id).eq("user_id", user.id);
          const lastRead = (ruData as unknown as { last_read_at: string } | null)?.last_read_at;
          if (!lastRead) continue;
          const { count, data: msgs } = await supabase.from("messages").select("id, created_at", { count: "exact" }).eq("room_id", membership.room_id).eq("is_ai", false).neq("user_id", user.id).gt("created_at", lastRead).order("created_at", { ascending: false }).limit(1);
          if ((count ?? 0) > 0) {
            notifs.push({
              roomId: membership.room_id,
              eventTitle: roomData?.event_title || "Event",
              unreadCount: count ?? 1,
              lastMessageAt: msgs?.[0]?.created_at || new Date().toISOString(),
            });
          }
        }
        setNotifications(notifs);
      }
    };
    load();
  }, []);

  // ── Load already-swiped events ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { swipesLoadedRef.current = true; return; }
      const { data: userSwipes } = await supabase.from("swipes").select("event_id").eq("user_id", user.id);
      swipedIdsRef.current = new Set((userSwipes || []).map((s) => s.event_id));
      swipesLoadedRef.current = true;
    })();
  }, []);

  const filterSwiped = useCallback((evts: EventData[]) => {
    if (!swipesLoadedRef.current) return evts;
    return evts.filter((e) => !swipedIdsRef.current.has(e.id));
  }, []);

  const loadEvents = useCallback(async (options: { lat?: number; lng?: number; city?: string } = {}) => {
    setLoadingEvents(true);
    lastLocationRef.current = { lat: options.lat, lng: options.lng, city: options.city };
    if (options.lat != null || options.city) saveLocation(lastLocationRef.current);
    try {
      const tmEvents = await fetchTicketmasterEvents({ ...options, size: 20 });
      const finalEvents = tmEvents.length > 0 ? tmEvents : MOCK_EVENTS;
      for (const e of finalEvents) eventTitlesRef.current[e.id] = e.title;
      setEvents(filterSwiped(sortEvents(finalEvents)));
      setNeedsCity(false);
    } catch {
      for (const e of MOCK_EVENTS) eventTitlesRef.current[e.id] = e.title;
      setEvents(filterSwiped(sortEvents(MOCK_EVENTS)));
    } finally { setLoadingEvents(false); }
  }, [sortEvents, filterSwiped]);

  useEffect(() => {
    const savedLocation = readSavedLocation();
    if (savedLocation?.lat != null || savedLocation?.city) {
      lastLocationRef.current = savedLocation;
      setCityInput(savedLocation.city || "");
      loadEvents(savedLocation);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => loadEvents({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setNeedsCity(true); setLoadingEvents(false); },
      { timeout: 6000 }
    );
  }, [loadEvents]);

  const handleCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const city = cityInput.trim();
    if (!city) return;
    loadEvents({ city });
  };

  // ── Search autocomplete ──────────────────────────────────────────────────────
  useEffect(() => {
    const query = searchQuery.trim();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query || query.length < 2) { setSuggestions([]); return; }
    setSuggestionsLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const loc = lastLocationRef.current;
        const results = await fetchTicketmasterEvents({ ...loc, keyword: query, size: 6 });
        setSuggestions(results);
      } catch { setSuggestions([]); }
      finally { setSuggestionsLoading(false); }
    }, 400);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const handleSelectSuggestion = useCallback((event: EventData) => {
    eventTitlesRef.current[event.id] = event.title;
    setEvents((prev) => [event, ...prev.filter((e) => e.id !== event.id)]);
    setIsSearching(true);
    setSearchQuery("");
    setSuggestions([]);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery(""); setSuggestions([]); setIsSearching(false);
    const loc = lastLocationRef.current;
    if (loc.lat || loc.city) loadEvents(loc);
  }, [loadEvents]);

  // ── Swipe counts ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await (supabase.rpc as unknown as (fn: string) => Promise<{ data: Array<{ event_id: string; swipe_count: number }> | null }>)("get_event_swipe_counts");
      const counts: Record<string, number> = {};
      for (const row of data || []) counts[row.event_id] = Number(row.swipe_count);
      setSwipeCounts(counts);
    })();
  }, []);

  // ── Swipe handler ────────────────────────────────────────────────────────────
  const handleSwipe = useCallback(async (direction: "left" | "right") => {
    const event = events[0];
    if (!event) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in first"); return; }
    const { error } = await supabase.from("swipes").insert({ user_id: user.id, event_id: event.id, direction });
    if (error && error.code !== "23505") { toast.error("Something went wrong"); return; }
    swipedIdsRef.current.add(event.id);
    if (direction === "right") {
      if (error?.code === "23505") {
        toast.info("You already liked this!");
      } else {
        toast.success(`You're interested in "${event.title}" ❤️`);
        setSwipeCount((c) => c + 1);
        setSwipeCounts((prev) => ({ ...prev, [event.id]: (prev[event.id] || 0) + 1 }));
        try {
          const liked = JSON.parse(localStorage.getItem("rekindle_liked_events") || "[]");
          if (!liked.some((e: { id: string }) => e.id === event.id)) {
            liked.push({ id: event.id, title: event.title, date: event.date, location: event.location, image: event.image });
            localStorage.setItem("rekindle_liked_events", JSON.stringify(liked));
          }
        } catch { /* ignore */ }
      }
      supabase.functions.invoke("matchmaking", { body: { event_titles: eventTitlesRef.current } }).catch(() => {});
    }
    setEvents((prev) => prev.slice(1));
  }, [events]);

  const triggerSwipe = useCallback((direction: "left" | "right") => handleSwipe(direction), [handleSwipe]);

  const handleFavourite = useCallback(() => {
    const event = events[0];
    if (!event) return;
    try {
      const favs: { id: string; title: string; date: string; location: string; image: string }[] =
        JSON.parse(localStorage.getItem("rekindle_favourites") || "[]");
      if (favs.some((e) => e.id === event.id)) {
        toast.info("Already in favourites");
        return;
      }
      favs.push({ id: event.id, title: event.title, date: event.date, location: event.location, image: event.image });
      localStorage.setItem("rekindle_favourites", JSON.stringify(favs));
      toast.success("Added to favourites");
    } catch { /* ignore */ }
  }, [events]);

  // ── Room check for top card ──────────────────────────────────────────────────
  useEffect(() => {
    const event = events[0];
    if (!event) { setCurrentEventRoomId(null); return; }
    supabase.from("rooms").select("id").eq("event_id", event.id).maybeSingle()
      .then(({ data }) => setCurrentEventRoomId(data?.id ?? null));
  }, [events]);

  // ── Close notif panel on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const popularEvent = useMemo(() => {
    if (events.length === 0) return null;
    return [...events].sort((a, b) => (swipeCounts[b.id] || b.attendees) - (swipeCounts[a.id] || a.attendees))[0];
  }, [events, swipeCounts]);

  const trendingEvents = useMemo(() => {
    return events.slice(1, 10)
      .sort((a, b) => (swipeCounts[b.id] || b.attendees) - (swipeCounts[a.id] || a.attendees))
      .slice(0, 3);
  }, [events, swipeCounts]);

  return (
    <AppShell>
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-background px-4 lg:px-8 pt-4 pb-24 lg:pb-8">

          {/* ── Header ────────────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-8 flex-shrink-0">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-display text-5xl lg:text-6xl font-bold tracking-tight">Discover</h1>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  Live
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Swipe on events you love. Match with people who feel the same.<br />
                Start conversations before you arrive.
              </p>
            </motion.div>

            {/* Right controls */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-2"
            >
              {/* Notifications bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((p) => !p)}
                  className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center hover:bg-secondary transition-colors shadow-sm relative"
                >
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-accent rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1">
                      {notifications.length}
                    </span>
                  )}
                </button>

                {/* Notifications dropdown */}
                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-11 w-72 bg-card border border-border rounded-2xl shadow-elevated z-50 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm font-semibold text-foreground">Notifications</p>
                      </div>
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <Bell className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">You're all caught up</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {notifications.map((n) => (
                            <button
                              key={n.roomId}
                              onClick={() => { navigate(`/chat/${n.roomId}`); setNotifOpen(false); }}
                              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                                <MessageCircle className="h-4 w-4 text-accent" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{n.eventTitle}</p>
                                <p className="text-xs text-muted-foreground">{n.unreadCount} new message{n.unreadCount > 1 ? "s" : ""} · {timeAgo(n.lastMessageAt)}</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Settings */}
              <button
                onClick={() => navigate("/settings")}
                className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center hover:bg-secondary transition-colors shadow-sm"
              >
                <Settings className="h-5 w-5 text-muted-foreground" />
              </button>

              {/* Profile badge */}
              <button
                onClick={() => navigate("/profile")}
                className="flex items-center gap-2.5 pl-1.5 pr-5 py-1.5 rounded-full bg-card border border-border hover:border-foreground/20 transition-all shadow-sm"
              >
                <img src={userAvatar} alt={userName} className="w-10 h-10 rounded-full object-cover bg-secondary" />
                <span className="text-sm font-semibold text-foreground">{userName || "You"}</span>
              </button>
            </motion.div>
          </div>

          {/* ── Main 2-column layout ───────────────────────────────────────────── */}
          <div className="flex gap-6 lg:gap-8 items-start">

            {/* ── Left column: search + card + buttons ────────────────────────── */}
            <div className="flex-1 min-w-0">

              {/* Always-visible search bar — matches card width */}
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events…"
                  className="w-full rounded-xl border border-border bg-card pl-10 pr-14 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                {isSearching && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                )}
                <AnimatePresence>
                  {(suggestions.length > 0 || suggestionsLoading) && (
                    <motion.div
                      ref={suggestionsRef}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-elevated"
                    >
                      {suggestionsLoading && (
                        <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
                          <div className="h-8 w-8 shrink-0 rounded-lg bg-secondary animate-pulse" />
                          <span>Searching…</span>
                        </div>
                      )}
                      {suggestions.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => handleSelectSuggestion(event)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/50"
                        >
                          <img src={event.image} alt={event.title} className="h-9 w-9 shrink-0 rounded-lg object-cover bg-secondary" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{event.date} · {event.location}</p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {loadingEvents ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-full rounded-2xl bg-secondary animate-pulse" style={{ height: "min(58vh, 560px)" }} />
                  <p className="text-sm text-muted-foreground">Finding events near you…</p>
                </div>
              ) : needsCity ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center text-center px-6 w-full max-w-sm mx-auto py-16"
                >
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
                    <MapPin className="h-9 w-9 text-accent" />
                  </div>
                  <h2 className="mb-2 font-display text-2xl font-bold">Where are you?</h2>
                  <p className="mb-6 text-sm text-muted-foreground">Allow location or enter your city to find events near you.</p>
                  <button
                    onClick={() => navigator.geolocation.getCurrentPosition(
                      (pos) => loadEvents({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                      () => toast.error("Location access denied — enter your city below"),
                      { timeout: 6000 }
                    )}
                    className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground hover:bg-secondary"
                  >
                    <MapPin className="h-4 w-4 text-accent" /> Use my location
                  </button>
                  <div className="mb-4 flex w-full items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex-1 border-t border-border" /> or <div className="flex-1 border-t border-border" />
                  </div>
                  <form onSubmit={handleCitySubmit} className="flex w-full gap-2">
                    <input
                      type="text" value={cityInput} onChange={(e) => setCityInput(e.target.value)}
                      placeholder="e.g. New York, Chicago, LA…"
                      className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                      autoFocus
                    />
                    <button type="submit" className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent/90">Go</button>
                  </form>
                </motion.div>
              ) : events.length > 0 ? (
                <>
                  {/* Card deck — viewport-relative height so buttons stay on screen */}
                  <div className="relative w-full" style={{ height: "min(58vh, 560px)" }}>
                    <div className="absolute inset-0">
                      <AnimatePresence>
                        {events.slice(0, 3).map((event, i) => (
                          <SwipeCard
                            key={event.id}
                            event={{ ...event, attendees: swipeCounts[event.id] || event.attendees }}
                            onSwipe={handleSwipe}
                            isTop={i === 0}
                            index={i}
                            roomId={i === 0 ? currentEventRoomId : null}
                            onOpenChat={() => currentEventRoomId && navigate(`/chat/${currentEventRoomId}`)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-center gap-6 mt-5">
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => triggerSwipe("left")}
                      className="w-14 h-14 rounded-full bg-card border-2 border-border flex items-center justify-center shadow-sm hover:border-foreground/20 transition-colors group"
                    >
                      <X className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => triggerSwipe("right")}
                      className="rounded-full bg-accent flex items-center justify-center shadow-[0_8px_24px_rgba(232,71,10,0.3)] hover:shadow-[0_12px_32px_rgba(232,71,10,0.4)] transition-shadow"
                      style={{ width: 72, height: 72 }}
                    >
                      <Heart className="h-8 w-8 text-white fill-white" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={handleFavourite}
                      className="w-14 h-14 rounded-full bg-card border-2 border-border flex items-center justify-center shadow-sm hover:border-amber-400/50 transition-colors group"
                    >
                      <Star className="h-6 w-6 text-muted-foreground group-hover:text-amber-500 group-hover:fill-amber-500 transition-colors" />
                    </motion.button>
                  </div>

                </>

              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center text-center px-6 py-20"
                >
                  <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
                    <Flame className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h2 className="mb-2 font-display text-2xl font-bold">No more events right now</h2>
                  <p className="text-muted-foreground max-w-sm">Check back later for more events near you!</p>
                </motion.div>
              )}
            </div>

            {/* ── Right column: Stats panel (desktop only) ─────────────────────── */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="hidden lg:flex flex-col gap-4 w-80 xl:w-96 flex-shrink-0 sticky top-4"
            >
              {/* Your Activity */}
              <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Your Activity</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="font-display text-3xl font-semibold text-foreground">{swipeCount}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Events liked</p>
                  </div>
                  <div className="h-px bg-border" />
                  <div>
                    <p className="font-display text-3xl font-semibold text-foreground">{roomCount}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Active group chats</p>
                  </div>
                </div>
              </div>

              {/* Popular Right Now */}
              {popularEvent && (
                <div className="bg-gradient-to-br from-accent to-orange-600 rounded-2xl p-5 text-white shadow-[0_8px_32px_rgba(232,71,10,0.2)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                      <Users className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-white/90">Popular Right Now</span>
                  </div>
                  <p className="font-display text-lg font-semibold mb-1 leading-tight">{popularEvent.title}</p>
                  <p className="text-sm text-white/75 mb-4">{swipeCounts[popularEvent.id] || popularEvent.attendees} people going</p>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectSuggestion(popularEvent)}
                    className="w-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors rounded-xl py-2.5 text-sm font-semibold"
                  >
                    View Event
                  </motion.button>
                </div>
              )}

              {/* Recent Matches */}
              {recentRooms.length > 0 && (
                <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Recent Matches</h3>
                  <div className="space-y-3">
                    {recentRooms.map((room) => (
                      <button
                        key={room.roomId}
                        onClick={() => navigate(`/chat/${room.roomId}`)}
                        className="flex items-center gap-3 w-full text-left group"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-orange-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                          {room.otherMemberName ? room.otherMemberName[0].toUpperCase() : room.eventTitle[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors">
                            {room.otherMemberName || "Matched!"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{room.eventTitle}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{timeAgo(room.createdAt)}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => navigate("/rooms")}
                    className="mt-4 w-full text-xs font-semibold text-accent hover:text-accent/80 transition-colors text-center"
                  >
                    View all chats →
                  </button>
                </div>
              )}

              {/* Empty state for new users */}
              {recentRooms.length === 0 && roomCount === 0 && !loadingEvents && (
                <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm text-center">
                  <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground mb-1">No matches yet</p>
                  <p className="text-xs text-muted-foreground">Swipe on events to get matched with people going to the same thing</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Trending This Week — full-width strip below both columns ──────── */}
          {trendingEvents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex-shrink-0 mt-4 hidden lg:block"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  <span className="text-sm font-semibold text-foreground">Trending This Week</span>
                </div>
                <button
                  onClick={() => setTrendingModalOpen(true)}
                  className="text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                >
                  View All →
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {trendingEvents.map((event, i) => (
                  <motion.button
                    key={event.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 + i * 0.06 }}
                    whileHover={{ y: -2 }}
                    onClick={() => handleSelectSuggestion(event)}
                    className="flex items-center gap-3 bg-card rounded-2xl p-4 border border-border/50 hover:border-border hover:shadow-sm transition-all text-left group"
                  >
                    <img
                      src={event.image}
                      alt={event.title}
                      className="w-14 h-14 rounded-xl object-cover bg-secondary shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">{event.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{event.date}</p>
                      <p className="text-xs text-muted-foreground">{swipeCounts[event.id] || event.attendees} going</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
      </div>

      {/* ── Trending Events Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {trendingModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setTrendingModalOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-accent" />
                    </div>
                    <h2 className="font-display text-xl font-semibold">Trending Events</h2>
                  </div>
                  <button onClick={() => setTrendingModalOpen(false)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-4">
                  {(trendingEvents.length > 0 ? trendingEvents : events.slice(0, 6)).map((event, i) => (
                    <motion.div key={event.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="p-6 rounded-xl border border-border hover:border-accent/20 hover:bg-accent/5 transition-all cursor-pointer"
                      onClick={() => { handleSelectSuggestion(event); setTrendingModalOpen(false); }}
                    >
                      <div className="flex items-start gap-4 mb-3">
                        <img src={event.image} alt={event.title} className="w-14 h-14 rounded-xl object-cover bg-secondary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg truncate">{event.title}</h3>
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                              +{Math.floor(Math.random() * 40) + 10}%
                            </span>
                          </div>
                          {event.tags[0] && (
                            <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                              {event.tags[0]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          {event.date}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location}
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" />
                          {swipeCounts[event.id] || event.attendees} going
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSelectSuggestion(event); setTrendingModalOpen(false); }}
                        className="w-full py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
                      >
                        View Event
                      </button>
                    </motion.div>
                  ))}
                  {trendingEvents.length === 0 && events.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Loading trending events…</p>
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </AppShell>
  );
};

export default Feed;
