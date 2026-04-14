import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import {
  Search,
  Sparkles,
  Users,
  Loader2,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { CountUpValue } from "@/components/CountUpValue";

const TM_API_KEY = import.meta.env.VITE_TICKETMASTER_API_KEY;

/** Looks like "Event 1A9ZkoAGkeNQrkt" — a raw TM id was used as the title */
function isBadTitle(title: string | null, eventId: string): boolean {
  return !title || title === `Event ${eventId}` || title.startsWith("Event ");
}

async function resolveTitles(rooms: RoomData[]): Promise<RoomData[]> {
  const bad = rooms.filter((r) => isBadTitle(r.event_title, r.event_id));
  if (bad.length === 0) return rooms;

  try {
    const ids = bad.map((r) => r.event_id).join(",");
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_API_KEY}&id=${ids}&size=${bad.length}`,
    );
    if (!res.ok) return rooms;
    const json = await res.json();
    const events: Array<{ id: string; name: string }> = json._embedded?.events ?? [];
    const nameMap: Record<string, string> = {};
    for (const e of events) nameMap[e.id] = e.name;

    return rooms.map((r) =>
      isBadTitle(r.event_title, r.event_id) && nameMap[r.event_id]
        ? { ...r, event_title: nameMap[r.event_id] }
        : r,
    );
  } catch {
    return rooms;
  }
}

interface RoomData {
  id: string;
  event_id: string;
  event_title: string | null;
  created_at: string;
  member_count: number;
}

/** Chats only exist once at least two people have liked the same event */
const MIN_CHAT_MEMBERS = 2;

function distinctMemberCounts(
  rows: { room_id: string; user_id: string }[] | null,
): Record<string, number> {
  const map = new Map<string, Set<string>>();
  for (const r of rows || []) {
    if (!map.has(r.room_id)) map.set(r.room_id, new Set());
    map.get(r.room_id)!.add(r.user_id);
  }
  const out: Record<string, number> = {};
  for (const [roomId, set] of map) out[roomId] = set.size;
  return out;
}

/** One row per event — prefer more members, then older room */
function dedupeRoomsByEventId(rooms: RoomData[]): RoomData[] {
  const m = new Map<string, RoomData>();
  for (const r of rooms) {
    const cur = m.get(r.event_id);
    if (
      !cur ||
      r.member_count > cur.member_count ||
      (r.member_count === cur.member_count && r.created_at < cur.created_at)
    ) {
      m.set(r.event_id, r);
    }
  }
  return [...m.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

const FILTERS = ["All", "Active", "New", "Archived"];

const Rooms = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRooms = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: memberships } = await supabase
        .from("room_users")
        .select("room_id")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) {
        const { data: swipes } = await supabase
          .from("swipes")
          .select("event_id")
          .eq("user_id", user.id)
          .eq("direction", "right");

        if (!swipes || swipes.length === 0) {
          setRooms([]);
          setLoading(false);
          return;
        }

        const likedEventIds = swipes.map((s) => s.event_id);
        const { data: roomData } = await supabase
          .from("rooms")
          .select("id, event_id, event_title, created_at")
          .in("event_id", likedEventIds);

        if (!roomData || roomData.length === 0) {
          setRooms([]);
          setLoading(false);
          return;
        }

        const roomIds = roomData.map((r) => r.id);
        const { data: memberRows } = await supabase
          .from("room_users")
          .select("room_id, user_id")
          .in("room_id", roomIds);

        const countMap = distinctMemberCounts(memberRows);
        const built = roomData
          .map((r) => ({
            ...r,
            member_count: countMap[r.id] ?? 0,
          }))
          .filter((r) => r.member_count >= MIN_CHAT_MEMBERS);
        setRooms(await resolveTitles(dedupeRoomsByEventId(built)));
        setLoading(false);
        return;
      }

      const roomIds = memberships.map((m) => m.room_id);

      const { data: roomData } = await supabase
        .from("rooms")
        .select("id, event_id, event_title, created_at")
        .in("id", roomIds);

      if (!roomData || roomData.length === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }

      const { data: memberRows } = await supabase
        .from("room_users")
        .select("room_id, user_id")
        .in("room_id", roomIds);

      const countMap = distinctMemberCounts(memberRows);
      const built = roomData
        .map((r) => ({
          ...r,
          member_count: countMap[r.id] ?? 0,
        }))
        .filter((r) => r.member_count >= MIN_CHAT_MEMBERS);
      setRooms(await resolveTitles(dedupeRoomsByEventId(built)));
      setLoading(false);
    };

    fetchUserRooms();
  }, []);

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const filteredRooms = rooms.filter((r) => {
    if (searchQuery && !(r.event_title || "").toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
    if (activeFilter === "New") return now - new Date(r.created_at).getTime() < 7 * DAY_MS;
    if (activeFilter === "Active") return now - new Date(r.created_at).getTime() < 30 * DAY_MS;
    if (activeFilter === "Archived") return now - new Date(r.created_at).getTime() >= 30 * DAY_MS;
    return true;
  });

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6 lg:px-12 lg:py-8 pb-24 lg:pb-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-start gap-3 sm:gap-4"
          >
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-border hover:bg-muted hover:text-foreground active:scale-[0.97] sm:mt-2"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
            <div className="min-w-0 flex-1">
              <h1
                className="mb-2 text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Chats
              </h1>
              {(loading || rooms.length > 0) && (
                <p className="text-base text-muted-foreground font-numeric tabular-nums sm:text-lg">
                  {loading ? (
                    "Fetching your conversations…"
                  ) : (
                    <>
                      <CountUpValue value={rooms.length} durationMs={800} /> active{" "}
                      {rooms.length === 1 ? "chat" : "chats"} · pick one to jump back in
                    </>
                  )}
                </p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="mb-8 rounded-2xl border border-border/40 bg-card p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] lg:p-6"
          >
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by event name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground shadow-card focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Filter
            </p>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                    activeFilter === filter
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </motion.div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading your chats…</p>
            </div>
          ) : rooms.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-card px-6 py-20 text-center shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
            >
              <h2 className="mb-2 text-2xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                No chats yet
              </h2>
              <p className="max-w-sm text-muted-foreground">
                Like events on Discover to get matched into group chats with other people going.
              </p>
              <button
                type="button"
                onClick={() => navigate("/feed")}
                className="mt-8 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Go to Discover
              </button>
            </motion.div>
          ) : filteredRooms.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card px-6 py-16 text-center shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
              <p className="text-sm font-medium text-foreground">No chats match</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another search or filter — you still have{" "}
                <span className="font-numeric tabular-nums">
                  <CountUpValue value={rooms.length} durationMs={400} />
                </span>{" "}
                {rooms.length === 1 ? "chat" : "chats"}.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Your rooms
                </p>
              </div>
              <ul className="space-y-3">
                {filteredRooms.map((room, i) => (
                  <motion.li
                    key={room.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/chat/${room.id}`)}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-border/50 bg-card p-4 text-left shadow-card transition-all hover:border-border hover:shadow-sm"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/10 transition-colors group-hover:bg-accent/15">
                        <Sparkles className="h-6 w-6 text-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground text-[15px] leading-snug">
                          {room.event_title || `Event ${room.event_id}`}
                        </h3>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground font-numeric tabular-nums">
                          <Users className="h-3 w-3 shrink-0" />
                          <CountUpValue value={room.member_count} durationMs={650} /> people in this
                          room
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </button>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default Rooms;
