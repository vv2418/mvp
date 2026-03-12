import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import { MessageCircle, Search, Sparkles, Users, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RoomData {
  id: string;
  event_id: string;
  event_title: string | null;
  created_at: string;
  member_count: number;
}

const FILTERS = ["All", "Active", "New", "Archived"];

const Rooms = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRooms = async () => {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get rooms user is a member of via room_users
      const { data: memberships } = await supabase
        .from("room_users")
        .select("room_id")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) {
        // Fallback: check rooms for events user swiped right on
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

        // Get member counts
        const roomIds = roomData.map((r) => r.id);
        const { data: members } = await supabase
          .from("room_users")
          .select("room_id")
          .in("room_id", roomIds);

        const countMap: Record<string, number> = {};
        for (const m of members || []) {
          countMap[m.room_id] = (countMap[m.room_id] || 0) + 1;
        }

        setRooms(
          roomData.map((r) => ({
            ...r,
            member_count: countMap[r.id] || 0,
          }))
        );
        setLoading(false);
        return;
      }

      const roomIds = memberships.map((m) => m.room_id);

      // Get room details
      const { data: roomData } = await supabase
        .from("rooms")
        .select("id, event_id, event_title, created_at")
        .in("id", roomIds);

      if (!roomData || roomData.length === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }

      // Get member counts for all rooms
      const { data: allMembers } = await supabase
        .from("room_users")
        .select("room_id")
        .in("room_id", roomIds);

      const countMap: Record<string, number> = {};
      for (const m of allMembers || []) {
        countMap[m.room_id] = (countMap[m.room_id] || 0) + 1;
      }

      setRooms(
        roomData.map((r) => ({
          ...r,
          member_count: countMap[r.id] || 0,
        }))
      );
      setLoading(false);
    };

    fetchUserRooms();
  }, []);

  const filteredRooms = rooms.filter((r) =>
    searchQuery
      ? (r.event_title || "").toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <AppShell>
      <div className="flex flex-1 flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-xl font-bold lg:text-2xl">Chats</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {rooms.length} conversation{rooms.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-secondary/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  activeFilter === filter
                    ? "bg-foreground text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1">
          <div className="flex-1 overflow-y-auto px-6 pb-24 lg:pb-8 lg:px-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-28">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRooms.length > 0 ? (
              <div className="mx-auto max-w-2xl">
                <div className="py-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Your Rooms
                  </p>
                </div>

                <div className="divide-y divide-border">
                  {filteredRooms.map((room, i) => (
                    <motion.button
                      key={room.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
                      onClick={() => navigate(`/chat/${room.id}`)}
                      className="flex w-full items-center gap-4 py-4 text-left transition-all hover:bg-secondary/30 -mx-3 px-3 rounded-xl"
                    >
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-accent/10">
                        <Sparkles className="h-6 w-6 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-foreground text-[15px] truncate">
                            {room.event_title || `Event ${room.event_id}`}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">
                            {room.member_count} member{room.member_count !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
                  <MessageCircle className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="mb-3 font-display text-2xl font-bold">No chats yet</h2>
                <p className="text-muted-foreground">Like events to get matched into groups!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Rooms;
