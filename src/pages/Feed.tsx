import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SwipeCard from "@/components/SwipeCard";
import AppShell from "@/components/AppShell";
import { MOCK_EVENTS } from "@/data/mockEvents";
import { fetchTicketmasterEvents } from "@/lib/ticketmaster";
import { EventData } from "@/components/EventCard";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { REKINDLE_LIKED_EVENTS_CHANGED } from "@/lib/rekindle-events";
import { CountUpValue } from "@/components/CountUpValue";
import {
  Flame, X, Heart, Star, MapPin, Search, Bell, Settings,
  TrendingUp, Sparkles, Users, MessageCircle, ChevronRight, Clock, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
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

/** Local calendar date as YYYY-MM-DD (for matching Ticketmaster `startDateIso`). */
function localDateIso(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function eventIsOnLocalDay(e: EventData, isoDay: string): boolean {
  if (e.startDateIso) return e.startDateIso === isoDay;
  if (!e.date || e.date === "TBA") return false;
  const parsed = new Date(`${e.date}, ${new Date().getFullYear()}`);
  if (Number.isNaN(parsed.getTime())) return false;
  return localDateIso(parsed) === isoDay;
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
  const location = useLocation();
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
  /** Full list for this location (not the shrinking swipe deck) — used for sidebar stats. */
  const [catalogEvents, setCatalogEvents] = useState<EventData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [needsCity, setNeedsCity] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const eventTitlesRef = useRef<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<EventData[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  type EventRoomStat = { roomId: string | null; memberCount: number };
  const [roomStatsByEvent, setRoomStatsByEvent] = useState<Record<string, EventRoomStat>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const lastLocationRef = useRef<{ lat?: number; lng?: number; city?: string }>({});
  const swipedIdsRef = useRef<Set<string>>(new Set());
  const swipesLoadedRef = useRef(false);
  const allEventsRef = useRef<EventData[]>([]);
  const chatLiveToastGuardRef = useRef(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeDateFilter, setActiveDateFilter] = useState<'any' | 'today' | 'week' | 'month'>('any');
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

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
  const [recentSwipersCount, setRecentSwipersCount] = useState(0);

  const refreshPulseStats = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_discover_pulse_stats");
    if (error || data == null) return;
    const row = data as { recent_swipers?: number };
    setRecentSwipersCount(Math.max(0, Number(row.recent_swipers) || 0));
  }, []);

  const reloadDiscoverStats = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from("profiles").select("name, avatar_url").eq("id", user.id).maybeSingle();
    const name = profile?.name || user.user_metadata?.name || "You";
    setUserName(name);
    setAvatarLoadFailed(false);
    setUserAvatar(profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`);

    const { count: sc } = await supabase.from("swipes").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("direction", "right");
    setSwipeCount(sc ?? 0);

    const { data: myRooms } = await supabase.from("room_users").select("room_id").eq("user_id", user.id);
    const membershipRoomIds = [...new Set((myRooms || []).map((r) => r.room_id))];

    if (membershipRoomIds.length === 0) {
      setRoomCount(0);
      setRecentRooms([]);
      setNotifications([]);
      return;
    }

    const { data: roomRows } = await supabase
      .from("rooms")
      .select("id, event_id, event_title, created_at")
      .in("id", membershipRoomIds)
      .order("created_at", { ascending: false });

    const byEvent = new Map<string, (typeof roomRows)[number]>();
    for (const r of roomRows || []) {
      const key = r.event_id || r.id;
      const cur = byEvent.get(key);
      if (!cur || r.created_at < cur.created_at) byEvent.set(key, r);
    }
    const uniqueRooms = [...byEvent.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const existingIds = new Set((roomRows || []).map((r) => r.id));

    const canonicalRoomIds = uniqueRooms.map((r) => r.id);
    let groupChatCount = 0;
    if (canonicalRoomIds.length > 0) {
      const { data: ruRows } = await supabase.from("room_users").select("room_id").in("room_id", canonicalRoomIds);
      const perRoom = new Map<string, number>();
      for (const row of ruRows || []) {
        perRoom.set(row.room_id, (perRoom.get(row.room_id) ?? 0) + 1);
      }
      groupChatCount = canonicalRoomIds.filter((id) => (perRoom.get(id) ?? 0) >= 2).length;
    }
    setRoomCount(groupChatCount);

    if (uniqueRooms.length === 0) {
      setRecentRooms([]);
      setNotifications([]);
      return;
    }

    const recentSlice = uniqueRooms.slice(0, 3);
    const withMembers = await Promise.all(
      recentSlice.map(async (room) => {
        const { data: others } = await supabase.from("room_users").select("user_id").eq("room_id", room.id).neq("user_id", user.id).limit(1);
        let otherMemberName: string | undefined;
        if (others?.[0]) {
          const { data: p } = await supabase.from("profiles").select("name").eq("id", others[0].user_id).maybeSingle();
          otherMemberName = p?.name;
        }
        return { roomId: room.id, eventTitle: room.event_title || "Event", createdAt: room.created_at, otherMemberName };
      })
    );
    setRecentRooms(withMembers);

    const notifsByEvent = new Map<string, Notification>();
    for (const membership of myRooms || []) {
      if (!existingIds.has(membership.room_id)) continue;
      const { data: roomData } = await supabase
        .from("rooms")
        .select("event_title, event_id")
        .eq("id", membership.room_id)
        .maybeSingle();
      const eventKey = roomData?.event_id || membership.room_id;
      const { data: ruData } = await (supabase.from("room_users") as unknown as { select: (c: string) => { eq: (a: string, b: string) => { eq: (a: string, b: string) => Promise<{ data: { last_read_at: string } | null }> } } })
        .select("last_read_at").eq("room_id", membership.room_id).eq("user_id", user.id);
      const lastRead = (ruData as unknown as { last_read_at: string } | null)?.last_read_at;
      if (!lastRead) continue;
      const { count, data: msgs } = await supabase.from("messages").select("id, created_at", { count: "exact" }).eq("room_id", membership.room_id).eq("is_ai", false).neq("user_id", user.id).gt("created_at", lastRead).order("created_at", { ascending: false }).limit(1);
      if ((count ?? 0) > 0) {
        const unread = count ?? 1;
        const lastAt = msgs?.[0]?.created_at || new Date().toISOString();
        const prev = notifsByEvent.get(eventKey);
        if (!prev) {
          notifsByEvent.set(eventKey, {
            roomId: membership.room_id,
            eventTitle: roomData?.event_title || "Event",
            unreadCount: unread,
            lastMessageAt: lastAt,
          });
        } else {
          notifsByEvent.set(eventKey, {
            ...prev,
            unreadCount: prev.unreadCount + unread,
            lastMessageAt: lastAt > prev.lastMessageAt ? lastAt : prev.lastMessageAt,
          });
        }
      }
    }
    setNotifications([...notifsByEvent.values()]);
  }, []);

  useEffect(() => {
    if (location.pathname !== "/feed") return;
    void reloadDiscoverStats();
  }, [location.pathname, reloadDiscoverStats]);

  useEffect(() => {
    if (location.pathname !== "/feed") return;
    void refreshPulseStats();
    const t = window.setInterval(() => void refreshPulseStats(), 45_000);
    const onLikes = () => void refreshPulseStats();
    window.addEventListener(REKINDLE_LIKED_EVENTS_CHANGED, onLikes);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(REKINDLE_LIKED_EVENTS_CHANGED, onLikes);
    };
  }, [location.pathname, refreshPulseStats]);

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
      allEventsRef.current = finalEvents;
      setCatalogEvents(finalEvents);
      const cats = [...new Set(finalEvents.flatMap(e => e.tags.slice(0, 1)).filter(Boolean))].slice(0, 8);
      setAvailableCategories(cats);
      setEvents(filterSwiped(sortEvents(finalEvents)));
      setNeedsCity(false);
    } catch {
      for (const e of MOCK_EVENTS) eventTitlesRef.current[e.id] = e.title;
      allEventsRef.current = MOCK_EVENTS;
      setCatalogEvents(MOCK_EVENTS);
      const cats = [...new Set(MOCK_EVENTS.flatMap(e => e.tags.slice(0, 1)).filter(Boolean))].slice(0, 8);
      setAvailableCategories(cats);
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

  // ── Category / date filter ───────────────────────────────────────────────────
  const applyFilters = useCallback((category: string, dateFilter: 'any' | 'today' | 'week' | 'month') => {
    let filtered = allEventsRef.current;
    if (category !== 'All') {
      filtered = filtered.filter(e => e.tags.some(t => t === category));
    }
    if (dateFilter !== 'any') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(today);
      if (dateFilter === 'today') rangeEnd.setDate(today.getDate() + 1);
      else if (dateFilter === 'week') rangeEnd.setDate(today.getDate() + 7);
      else if (dateFilter === 'month') rangeEnd.setDate(today.getDate() + 30);
      filtered = filtered.filter(e => {
        if (!e.date || e.date === 'TBA') return false;
        const d = new Date(`${e.date}, ${new Date().getFullYear()}`);
        return !isNaN(d.getTime()) && d >= today && d < rangeEnd;
      });
    }
    setEvents(filterSwiped(sortEvents(filtered)));
  }, [filterSwiped, sortEvents]);

  useEffect(() => {
    if (!loadingEvents) applyFilters(activeCategory, activeDateFilter);
  }, [activeCategory, activeDateFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const loadRoomStatsForIds = useCallback(async (eventIds: string[]) => {
    const uniq = [...new Set(eventIds.filter(Boolean))];
    if (uniq.length === 0) return;

    const { data: rooms, error } = await supabase.from("rooms").select("id, event_id").in("event_id", uniq);
    if (error) return;

    const list = rooms || [];
    const roomIds = list.map((r) => r.id);
    const roomIdByEvent = new Map(list.map((r) => [r.event_id, r.id]));

    const counts = new Map<string, number>();
    if (roomIds.length > 0) {
      const { data: ru } = await supabase.from("room_users").select("room_id").in("room_id", roomIds);
      for (const row of ru || []) {
        counts.set(row.room_id, (counts.get(row.room_id) ?? 0) + 1);
      }
    }

    setRoomStatsByEvent((prev) => {
      const next = { ...prev };
      for (const eid of uniq) {
        const rid = roomIdByEvent.get(eid);
        if (!rid) next[eid] = { roomId: null, memberCount: 0 };
        else next[eid] = { roomId: rid, memberCount: counts.get(rid) ?? 0 };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const ids = [...new Set([...catalogEvents.map((e) => e.id), ...events.map((e) => e.id)])];
    void loadRoomStatsForIds(ids);
  }, [catalogEvents, events, loadRoomStatsForIds]);

  useEffect(() => {
    if (location.pathname !== "/feed") return;
    const refresh = () => {
      void reloadDiscoverStats();
      void loadRoomStatsForIds(allEventsRef.current.map((e) => e.id));
    };
    const onLikes = () => refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(REKINDLE_LIKED_EVENTS_CHANGED, onLikes);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(REKINDLE_LIKED_EVENTS_CHANGED, onLikes);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [location.pathname, reloadDiscoverStats, loadRoomStatsForIds]);

  // ── Swipe handler ────────────────────────────────────────────────────────────
  const handleSwipe = useCallback(async (direction: "left" | "right") => {
    const event = events[0];
    if (!event) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in first"); return; }
    const priorRoomId = roomStatsByEvent[event.id]?.roomId ?? null;
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
        void refreshPulseStats();

        chatLiveToastGuardRef.current = false;
        const tryChatCreatedToast = async () => {
          if (chatLiveToastGuardRef.current) return;
          const { data: room } = await supabase.from("rooms").select("id").eq("event_id", event.id).maybeSingle();
          const refreshIds = [...new Set([event.id, ...events.slice(1, 4).map((e) => e.id)])];
          await loadRoomStatsForIds(refreshIds);
          if (room?.id && !priorRoomId) {
            chatLiveToastGuardRef.current = true;
            toast.success(`Your Rekindle group chat for "${event.title}" is live — open Preview chat to peek in.`);
          }
        };
        window.setTimeout(() => void tryChatCreatedToast(), 2000);
        window.setTimeout(() => void tryChatCreatedToast(), 6000);
      }
      window.dispatchEvent(new CustomEvent(REKINDLE_LIKED_EVENTS_CHANGED));
      supabase.functions
        .invoke("matchmaking", { body: { event_titles: eventTitlesRef.current } })
        .catch(() => {})
        .finally(() => {
          window.setTimeout(() => void reloadDiscoverStats(), 1500);
          window.setTimeout(() => void reloadDiscoverStats(), 5000);
        });
    }
    setEvents((prev) => prev.slice(1));
  }, [events, reloadDiscoverStats, refreshPulseStats, roomStatsByEvent, loadRoomStatsForIds]);

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

  // ── Close notif panel on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const catalogSortedByHeat = useMemo(() => {
    const pool = catalogEvents.length > 0 ? catalogEvents : events;
    const heat = (id: string) =>
      (swipeCounts[id] ?? 0) + (roomStatsByEvent[id]?.memberCount ?? 0) * 2;
    return [...pool].sort((a, b) => heat(b.id) - heat(a.id));
  }, [catalogEvents, events, swipeCounts, roomStatsByEvent]);

  const popularEvent = useMemo(() => catalogSortedByHeat[0] ?? null, [catalogSortedByHeat]);

  const trendingEvents = useMemo(() => catalogSortedByHeat.slice(1, 4), [catalogSortedByHeat]);

  const eventsTodayCount = useMemo(() => {
    const today = localDateIso();
    return catalogEvents.filter((e) => eventIsOnLocalDay(e, today)).length;
  }, [catalogEvents]);

  const nearYouCount = catalogEvents.length;

  /** Top primary tags in the current catalog by total right-swipes (global) + catalog presence. */
  const trendingTagRows = useMemo(() => {
    const scores = new Map<string, number>();
    for (const e of catalogEvents) {
      const tag = e.tags[0] || "Events";
      const sw = swipeCounts[e.id] ?? 0;
      scores.set(tag, (scores.get(tag) ?? 0) + sw + 1);
    }
    const rows = [...scores.entries()]
      .map(([label, score]) => ({ label, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const max = rows[0]?.score ?? 1;
    return rows.map((r) => ({ ...r, barPct: Math.max(8, Math.round((r.score / max) * 100)) }));
  }, [catalogEvents, swipeCounts]);

  const avatarFallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName || "You"}`;
  const profileAvatarSrc = !avatarLoadFailed && userAvatar ? userAvatar : avatarFallback;

  return (
    <AppShell>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background px-4 lg:px-16 pt-4 lg:pt-10 pb-24 lg:pb-10">
          <div className="max-w-[1400px] mx-auto w-full flex flex-col flex-1 min-h-0">

          {/* ── Header ────────────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-8 flex-shrink-0">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-end gap-3 mb-4">
                <h1 className="text-5xl leading-none" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>Discover</h1>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-0.5">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  Live
                </div>
              </div>
              <p className="text-base text-muted-foreground">
                Swipe on events you love. Match with people who feel the same.
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
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-accent rounded-full flex items-center justify-center text-white text-[10px] font-numeric px-1 tabular-nums">
                      <CountUpValue value={notifications.length} durationMs={600} />
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
                <img
                  src={profileAvatarSrc}
                  alt={userName}
                  onError={() => setAvatarLoadFailed(true)}
                  className="w-10 h-10 rounded-full object-cover bg-secondary"
                />
                <span className="text-sm font-semibold text-foreground">{userName || "You"}</span>
              </button>
            </motion.div>
          </div>

          {/* ── Main 2-column layout ───────────────────────────────────────────── */}
          <div className="flex gap-8 lg:gap-12 flex-1 min-h-0">

            {/* ── Left column: search + card + buttons ────────────────────────── */}
            <div className="flex-1 min-w-0 max-w-lg flex flex-col min-h-0">

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

              {/* ── Filter chips ─────────────────────────────────────────────── */}
              {!loadingEvents && !needsCity && (
                <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-none flex-shrink-0 pb-0.5">
                  {(['any', 'today', 'week', 'month'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveDateFilter(f)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                        activeDateFilter === f
                          ? 'bg-accent border-accent text-white'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f === 'any' ? 'Any time' : f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'This Month'}
                    </button>
                  ))}
                  {availableCategories.length > 0 && <div className="w-px bg-border flex-shrink-0 mx-0.5 self-stretch" />}
                  {['All', ...availableCategories].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                        activeCategory === cat
                          ? 'bg-foreground border-foreground text-background'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

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
                        {events.slice(0, 3).map((event, i) => {
                          const stat = roomStatsByEvent[event.id];
                          return (
                          <SwipeCard
                            key={event.id}
                            event={event}
                            onSwipe={handleSwipe}
                            isTop={i === 0}
                            index={i}
                            roomId={stat?.roomId ?? null}
                            roomMemberCount={stat?.memberCount ?? 0}
                            onOpenChat={() => {
                              const rid = stat?.roomId;
                              if (rid) navigate(`/chat/${rid}?preview=1`);
                            }}
                          />
                          );
                        })}
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

            {/* ── Right column (desktop only) ───────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="hidden lg:flex flex-col gap-4 flex-1 min-w-0 min-h-0"
            >
            <div className="grid grid-cols-2 gap-4 flex-1" style={{ gridAutoRows: '1fr' }}>

              {/* ── Card 1: Active Now ── */}
              <div className="bg-card rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Now</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-green-600 font-semibold">Live</span>
                  </div>
                </div>
                {/* Hero number */}
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-5xl font-numeric text-foreground leading-none"><CountUpValue value={recentSwipersCount} /></p>
                  <p className="text-sm text-muted-foreground mt-1">people liked an event recently</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">Unique accounts, last ~45 minutes</p>
                </div>
                {/* Mini stats row */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-xl font-numeric text-foreground"><CountUpValue value={eventsTodayCount} durationMs={700} /></p>
                    <p className="text-[11px] text-muted-foreground">events today</p>
                  </div>
                  <div>
                    <p className="text-xl font-numeric text-foreground"><CountUpValue value={nearYouCount} durationMs={700} /></p>
                    <p className="text-[11px] text-muted-foreground">in this area</p>
                  </div>
                </div>
              </div>

              {/* ── Card 2: Trending ── */}
              <div className="bg-gradient-to-br from-accent to-orange-600 rounded-2xl p-5 text-white shadow-[0_8px_32px_rgba(232,71,10,0.2)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-white/80" />
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Trending</span>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-3">
                  {trendingTagRows.length > 0 ? (
                    trendingTagRows.map((cat) => (
                      <div key={cat.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-white">{cat.label}</span>
                          <span className="text-xs font-numeric bg-white/20 px-2 py-0.5 rounded-full tabular-nums">
                            {cat.score} pts
                          </span>
                        </div>
                        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white/60 rounded-full transition-all"
                            style={{ width: `${cat.barPct}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white/75">Load events to see category buzz from likes in your area.</p>
                  )}
                </div>
              </div>

              {/* ── Card 3: Your Activity ── */}
              <div className="bg-card rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Activity</span>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3 items-center">
                  <div className="flex flex-col items-center justify-center bg-accent/5 rounded-xl py-3 px-2">
                    <p className="text-4xl font-numeric text-accent leading-none"><CountUpValue value={swipeCount} /></p>
                    <p className="text-[11px] text-muted-foreground mt-1.5 text-center">events liked</p>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-muted/60 rounded-xl py-3 px-2">
                    <p className="text-4xl font-numeric text-foreground leading-none"><CountUpValue value={roomCount} /></p>
                    <p className="text-[11px] text-muted-foreground mt-1.5 text-center">group chats</p>
                  </div>
                </div>
              </div>

              {/* ── Card 4: Popular Now / Empty ── */}
              {popularEvent ? (
                <div className="relative rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex flex-col">
                  {/* event image as background */}
                  <img src={popularEvent.image} alt={popularEvent.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
                  <div className="relative z-10 flex flex-col justify-end h-full p-5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="h-3.5 w-3.5 text-white/80" />
                      <span className="text-xs text-white/80 font-medium uppercase tracking-wide">Popular Now</span>
                    </div>
                    <p className="text-base font-bold text-white leading-tight mb-1">{popularEvent.title}</p>
                    <p className="text-xs text-white/70 mb-3">
                      {(roomStatsByEvent[popularEvent.id]?.memberCount ?? 0) === 0
                        ? "No one from Rekindle in the chat yet"
                        : `${roomStatsByEvent[popularEvent.id]?.memberCount} from Rekindle in chat`}
                    </p>
                    <button onClick={() => handleSelectSuggestion(popularEvent)}
                      className="w-full bg-card/95 text-foreground border border-border/70 rounded-xl py-2 text-xs font-bold hover:bg-card transition-colors">
                      View Event
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-card rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center text-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-accent" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No matches yet</p>
                  <p className="text-xs text-muted-foreground">Swipe right to get matched into group chats</p>
                </div>
              )}
            </div>{/* end 2x2 grid */}

            {/* ── Trending This Week — inside right column ─────────────────── */}
            {trendingEvents.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-accent" />
                    <span className="text-sm font-semibold text-foreground">Trending This Week</span>
                  </div>
                  <button onClick={() => setTrendingModalOpen(true)} className="text-xs font-semibold text-accent hover:text-accent/80 transition-colors">
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
                      <img src={event.image} alt={event.title} className="w-14 h-14 rounded-xl object-cover bg-secondary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">{event.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{event.date}</p>
                        <p className="text-xs text-muted-foreground">
                          {(roomStatsByEvent[event.id]?.memberCount ?? 0) === 0
                            ? "No Rekindle chat yet"
                            : `${roomStatsByEvent[event.id]?.memberCount} in Rekindle chat`}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
            </motion.div>{/* end right column */}
          </div>{/* end 2-col layout */}
          </div>{/* end max-w wrapper */}
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
                          {(roomStatsByEvent[event.id]?.memberCount ?? 0) === 0
                            ? "No Rekindle chat yet"
                            : `${roomStatsByEvent[event.id]?.memberCount} in Rekindle chat`}
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
