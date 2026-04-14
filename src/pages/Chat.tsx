import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { CountUpValue } from "@/components/CountUpValue";
import AppShell from "@/components/AppShell";
import MemberProfileSheet from "@/components/MemberProfileSheet";
import MentionInput from "@/components/chat/MentionInput";
import MessageBubble from "@/components/chat/MessageBubble";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RoomMember {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  interests: string[];
}

interface Message {
  id: string;
  user_id: string | null;
  sender_name: string;
  content: string;
  is_ai: boolean;
  created_at: string;
}

const CHAT_IDLE_MINUTES = Math.max(
  1,
  Number(import.meta.env.VITE_CHAT_IDLE_MINUTES || 10),
);

/** Generate an event-specific icebreaker message */
function getEventIcebreaker(eventTitle: string): string {
  const lower = eventTitle.toLowerCase();
  if (lower.includes("music") || lower.includes("concert") || lower.includes("dj"))
    return `Welcome to the "${eventTitle}" room! 🎵 I'm here to help break the ice. What's a song that's been on repeat for you lately? Anyone been to a similar show before?`;
  if (lower.includes("food") || lower.includes("brunch") || lower.includes("dinner") || lower.includes("taco"))
    return `Hey foodies! Welcome to "${eventTitle}" 🍽️ What's your go-to comfort food? And does anyone have a favorite spot near the venue?`;
  if (lower.includes("tech") || lower.includes("hack") || lower.includes("startup") || lower.includes("pitch"))
    return `Welcome to "${eventTitle}"! 💻 What are you working on right now? Any cool side projects or ideas you're excited about?`;
  if (lower.includes("fitness") || lower.includes("run") || lower.includes("yoga") || lower.includes("hike"))
    return `Hey everyone! Welcome to "${eventTitle}" 💪 What's your fitness routine like? Anyone done an event like this before?`;
  if (lower.includes("comedy") || lower.includes("standup") || lower.includes("improv"))
    return `Welcome to "${eventTitle}"! 😂 Who's your favorite comedian right now? This is going to be a great time!`;
  if (lower.includes("art") || lower.includes("gallery") || lower.includes("museum"))
    return `Hey art lovers! Welcome to "${eventTitle}" 🎨 What kind of art are you into? Anyone been to this gallery before?`;
  if (lower.includes("game") || lower.includes("gaming") || lower.includes("board"))
    return `Welcome to "${eventTitle}"! 🎮 What games are you into right now? Let's get to know each other before we meet up!`;
  if (lower.includes("salsa") || lower.includes("dance"))
    return `Welcome to "${eventTitle}"! 💃 Who's ready to hit the dance floor? Any experienced dancers here or are we all beginners?`;
  if (lower.includes("movie") || lower.includes("film") || lower.includes("cinema"))
    return `Welcome to "${eventTitle}"! 🎬 What's the last movie that blew your mind? Let's get to know each other's taste!`;
  return `Welcome to the "${eventTitle}" room! 🔥 I'm Rekindled AI — here to help you all connect before the event. What are you most excited about for this one?`;
}

function MemberTile({
  member,
  onClick,
  variant,
}: {
  member: RoomMember;
  onClick: () => void;
  variant: "chip" | "row";
}) {
  const avatarUrl =
    member.avatar_url ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.id)}`;
  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex shrink-0 flex-col items-center gap-1.5"
      >
        <img
          src={avatarUrl}
          alt={member.name}
          className="h-11 w-11 rounded-xl border-2 border-transparent bg-secondary object-cover transition-all group-hover:border-accent/40"
        />
        <span className="max-w-[68px] truncate text-[10px] text-muted-foreground transition-colors group-hover:text-foreground">
          {member.name.split(" ")[0]}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background/50 p-3 text-left transition-all hover:border-border hover:bg-muted/40"
    >
      <img
        src={avatarUrl}
        alt={member.name}
        className="h-12 w-12 shrink-0 rounded-xl bg-secondary object-cover"
      />
      <span className="min-w-0 flex-1 truncate font-semibold text-sm text-foreground">{member.name}</span>
    </button>
  );
}

const Chat = () => {
  useRequireAuth();
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  /** Opened from Discover "Preview event chat" — show read-only upsell only in this case */
  const isDiscoverPreview = searchParams.get("preview") === "1";
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomTitle, setRoomTitle] = useState("");
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [canReply, setCanReply] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("You");
  const [selectedMember, setSelectedMember] = useState<RoomMember | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<number | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (loading || !roomId || !canReply || !isDiscoverPreview) return;
    navigate(`/chat/${roomId}`, { replace: true });
  }, [loading, canReply, isDiscoverPreview, roomId, navigate]);

  // Load room data + existing messages
  useEffect(() => {
    if (!roomId) return;

    const fetchAll = async () => {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      setCurrentUserId(user.id);
      setCurrentUserName(user.user_metadata?.name || "You");

      // Get room info
      const { data: room } = await supabase
        .from("rooms")
        .select("id, event_title, event_id")
        .eq("id", roomId)
        .maybeSingle();

      if (!room) { navigate("/rooms"); return; }
      const title = room.event_title || "Chat Room";
      setRoomTitle(title);

      const swipePromise = room.event_id
        ? supabase
            .from("swipes")
            .select("id")
            .eq("user_id", user.id)
            .eq("event_id", room.event_id)
            .eq("direction", "right")
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null as { id: string } | null });

      const [{ data: likedSwipe }, { data: membership }] = await Promise.all([
        swipePromise,
        supabase
          .from("room_users")
          .select("id")
          .eq("room_id", roomId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const eligible = Boolean(membership) || Boolean(likedSwipe);

      if (eligible && !membership) {
        const { error: joinErr } = await supabase.from("room_users").insert({ room_id: roomId!, user_id: user.id });
        if (joinErr && joinErr.code !== "23505") {
          console.warn("room_users insert:", joinErr.message);
        }
      }

      const { data: membershipFinal } = await supabase
        .from("room_users")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();

      const canReplyFinal = Boolean(membershipFinal) || Boolean(likedSwipe);
      setCanReply(canReplyFinal);

      // Load existing messages
      const { data: existingMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (existingMessages && existingMessages.length > 0) {
        setMessages(existingMessages);
      } else {
        // No messages yet — seed the AI icebreaker
        const { data: aiMsg } = await supabase
          .from("messages")
          .insert({
            room_id: roomId,
            user_id: null,
            sender_name: "Rekindled AI",
            content: getEventIcebreaker(title),
            is_ai: true,
          })
          .select()
          .single();
        if (aiMsg) setMessages([aiMsg]);
      }

      const { data: roomMembers } = await supabase
        .from("room_users")
        .select("user_id")
        .eq("room_id", roomId);

      const uniqueUserIds =
        roomMembers && roomMembers.length > 0
          ? [...new Set(roomMembers.map((m) => m.user_id))]
          : [];

      if (uniqueUserIds.length > 0) {
        const [{ data: profiles }, { data: interests }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, name, avatar_url, bio")
            .in("id", uniqueUserIds),
          supabase.from("user_interests").select("user_id, interest_id").in("user_id", uniqueUserIds),
        ]);

        const interestMap: Record<string, string[]> = {};
        for (const i of interests || []) {
          if (!interestMap[i.user_id]) interestMap[i.user_id] = [];
          interestMap[i.user_id].push(i.interest_id);
        }

        const profileById = new Map((profiles || []).map((p) => [p.id, p]));

        setMembers(
          uniqueUserIds.map((uid) => {
            const p = profileById.get(uid);
            if (p) {
              return {
                id: p.id,
                name: p.name || "Anonymous",
                avatar_url: p.avatar_url,
                bio: p.bio ?? null,
                interests: interestMap[p.id] || [],
              };
            }
            return {
              id: uid,
              name: "Attendee",
              avatar_url: null,
              bio: null,
              interests: [],
            };
          })
        );
      } else {
        setMembers([]);
      }

      setLoading(false);

      if (user && membershipFinal) {
        void supabase
          .from("room_users")
          .update({ last_read_at: new Date().toISOString() })
          .eq("room_id", roomId)
          .eq("user_id", user.id);
      }
    };

    fetchAll();
  }, [roomId, navigate]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const triggerIdleRevive = useCallback(async () => {
    if (!roomId || !roomTitle || !currentUserId) return;

    try {
      const { error: aiErr } = await supabase.functions.invoke("chat-ai", {
        body: {
          room_id: roomId,
          event_title: roomTitle,
          user_id: currentUserId,
          mode: "revive",
          idle_after_minutes: CHAT_IDLE_MINUTES,
        },
      });
      if (aiErr) console.error("Idle revive error:", aiErr);
    } catch (err) {
      console.error("Idle revive error:", err);
    }
  }, [roomId, roomTitle, currentUserId]);

  useEffect(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    const latestTimestamp = new Date(latestMessage.created_at).getTime();
    if (!Number.isFinite(latestTimestamp)) return;

    const triggerAt = latestTimestamp + CHAT_IDLE_MINUTES * 60 * 1000;
    const delay = Math.max(0, triggerAt - Date.now());

    idleTimerRef.current = window.setTimeout(() => {
      triggerIdleRevive();
    }, delay);

    return () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [messages, triggerIdleRevive]);

  const showReadOnlyDiscoverBanner = !canReply && isDiscoverPreview;

  const handleSend = async (text: string) => {
    if (!roomId || !currentUserId) return;
    if (!canReply) {
      toast.error(
        isDiscoverPreview
          ? "Like this event on Discover to join the conversation"
          : "You need to like this event before you can reply",
      );
      return;
    }

    // Insert into DB (realtime will add it to the list)
    await supabase
      .from("messages")
      .insert({
        room_id: roomId,
        user_id: currentUserId,
        sender_name: currentUserName,
        content: text,
        is_ai: false,
      })
      .select()
      .single();

    // Push notify other room members (fire-and-forget)
    const otherMembers = members.filter((m) => m.id !== currentUserId);
    for (const member of otherMembers) {
      supabase.functions.invoke("send-notification", {
        body: {
          type: "new_message",
          recipient_user_id: member.id,
          data: {
            event_title: roomTitle,
            room_id: roomId,
            sender_name: currentUserName,
            message_count: 1,
          },
        },
      }).catch(() => {});
    }

    // Get recent messages for AI context
    const recentMsgs = messages.slice(-10).concat({ id: "temp", user_id: currentUserId, sender_name: currentUserName, content: text, is_ai: false, created_at: new Date().toISOString() });

    const { error: aiErr } = await supabase.functions.invoke("chat-ai", {
      body: {
        room_id: roomId,
        event_title: roomTitle,
        recent_messages: recentMsgs.map(m => ({ sender_name: m.sender_name, content: m.content })),
        user_id: currentUserId,
      },
    });
    if (aiErr) {
      console.error("AI response error:", aiErr);
      toast.error("Rekindled AI could not reply. Check the chat-ai function and AI gateway env vars.");
    }
  };

  const mentionOptions = [
    { id: "ai", name: "Rekindled AI", isAI: true },
    ...members
      .filter((m) => m.id !== currentUserId)
      .map((m) => ({ id: m.id, name: m.name })),
  ];

  const handleMemberClick = (member: RoomMember) => {
    setSelectedMember(member);
    setSheetOpen(true);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-1 items-center justify-center bg-background px-6">
          <div className="flex max-w-[1400px] flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading chat…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-sm px-4 py-4 lg:px-8"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/rooms")}
                aria-label="Go back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground shadow-sm transition-all hover:border-border hover:bg-muted hover:text-foreground active:scale-[0.96]"
              >
                <ArrowLeft className="h-[17px] w-[17px]" strokeWidth={2} />
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[15px] font-semibold leading-tight text-foreground sm:text-base">
                  {roomTitle}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Member avatar cluster */}
                  {members.length > 0 && (
                    <div className="flex -space-x-1.5">
                      {members.slice(0, 5).map((m) => (
                        <img
                          key={m.id}
                          src={m.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(m.id)}`}
                          alt={m.name}
                          className="h-5 w-5 rounded-full border-2 border-background bg-secondary object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    {members.length} {members.length === 1 ? "person" : "people"} going
                  </span>
                </div>
              </div>

              {/* Desktop: member list toggle hint */}
              <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/50 px-3 py-1.5">
                <Sparkles className="h-3 w-3 text-accent" />
                <span className="text-[11px] font-medium text-muted-foreground">Group chat</span>
              </div>
            </div>
          </motion.div>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <div className="flex min-h-0 flex-1 gap-0 lg:gap-6 lg:px-8 lg:py-6">

            {/* Chat column */}
            <section className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:rounded-2xl lg:border lg:border-border/50 lg:shadow-[0_2px_12px_rgba(0,0,0,0.05)]">

                {/* Preview banner */}
                {showReadOnlyDiscoverBanner && (
                  <div className="shrink-0 border-b border-accent/15 bg-accent/[0.04] px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-foreground">Previewing this chat</p>
                        <p className="text-[12px] text-muted-foreground">Like the event on Discover to reply.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate("/feed")}
                        className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        Go to Discover
                      </button>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 lg:px-6">
                  <div className="mx-auto max-w-2xl pb-2">
                    {messages.map((msg, i) => {
                      const prev = messages[i - 1];
                      const next = messages[i + 1];
                      const sameAsPrev = prev && prev.user_id === msg.user_id && prev.is_ai === msg.is_ai;
                      const sameAsNext = next && next.user_id === msg.user_id && next.is_ai === msg.is_ai;
                      const member = members.find((m) => m.id === msg.user_id);
                      return (
                        <MessageBubble
                          key={msg.id}
                          senderName={msg.sender_name}
                          content={msg.content}
                          isMe={msg.user_id === currentUserId && !msg.is_ai}
                          isAI={msg.is_ai}
                          avatarUrl={member?.avatar_url}
                          timestamp={new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          index={i}
                          isFirstInGroup={!sameAsPrev}
                          isLastInGroup={!sameAsNext}
                        />
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Input */}
                <div className="shrink-0 border-t border-border/50 bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 lg:px-6">
                  <div className="mx-auto max-w-2xl">
                    <MentionInput options={mentionOptions} onSend={handleSend} disabled={!canReply} />
                  </div>
                </div>
              </div>
            </section>

            {/* Desktop sidebar — members */}
            <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col xl:w-72">
              <div className="flex max-h-[calc(100svh-200px)] flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                <div className="border-b border-border/40 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    In this room
                  </p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-1">
                  {members.length === 0 ? (
                    <p className="px-2 py-4 text-sm text-muted-foreground">No members yet.</p>
                  ) : (
                    members.map((member) => (
                      <MemberTile
                        key={member.id}
                        member={member}
                        variant="row"
                        onClick={() => handleMemberClick(member)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Mobile members strip below on mobile — still inside this hidden block intentionally */}
            </aside>
          </div>

          {/* Mobile: members strip */}
          <div className="shrink-0 border-t border-border/40 bg-card px-4 py-3 lg:hidden">
            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-0.5">
              {members.map((member) => (
                <MemberTile
                  key={member.id}
                  member={member}
                  variant="chip"
                  onClick={() => handleMemberClick(member)}
                />
              ))}
            </div>
          </div>

        </div>

        <MemberProfileSheet
          member={selectedMember}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          eventTitle={roomTitle}
        />
      </div>
    </AppShell>
  );
};

export default Chat;
