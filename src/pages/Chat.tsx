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
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";

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

/**
 * Local fallback icebreaker — only used if the AI welcome message hasn't been
 * seeded yet (e.g. legacy room with no messages). Keep it short and casual;
 * the real welcome comes from the chat-ai edge function.
 */
function getEventIcebreaker(eventTitle: string): string {
  return `new chat for "${eventTitle}" — say hi 👋`;
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
  const avatarUrl = member.avatar_url || DEFAULT_AVATAR_URL;
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
  };

  const mentionOptions = [
    { id: "ai", name: "Rekindled AI", isAI: true },
    ...members
      .filter((m) => m.id !== currentUserId)
      .map((m) => ({ id: m.id, name: m.name, avatarUrl: m.avatar_url })),
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
        <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col px-6 py-6 lg:px-12 lg:py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 shrink-0"
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => navigate("/rooms")}
                aria-label="Go back"
                className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-border hover:bg-muted hover:text-foreground active:scale-[0.97] sm:mt-2"
              >
                <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
              <div className="min-w-0 flex-1">
                <h1
                  className="line-clamp-2 text-2xl font-semibold leading-tight sm:text-3xl lg:text-4xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {roomTitle}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground font-numeric tabular-nums sm:text-base">
                  Group chat · <CountUpValue value={members.length} durationMs={700} />{" "}
                  {members.length === 1 ? "person" : "people"} ·{" "}
                  <CountUpValue value={messages.length} durationMs={500} /> messages
                </p>
              </div>
            </div>
          </motion.div>

          <div className="flex min-h-0 flex-1 flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-8">
            {/* Mobile: members strip (top) */}
            <div className="order-1 shrink-0 rounded-2xl border border-border/40 bg-card p-4 shadow-[0_4px_16px_rgba(0,0,0,0.04)] lg:hidden">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                In this room
              </p>
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide">
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

            {/* Chat column — left on desktop */}
            <section className="order-2 flex min-h-0 flex-1 flex-col lg:order-1 lg:col-span-8 xl:col-span-9">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_4px_16px_rgba(0,0,0,0.04)] lg:min-h-[calc(100svh-240px)]">
                {showReadOnlyDiscoverBanner && (
                  <div className="shrink-0 border-b border-accent/15 bg-accent/5 px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-3 rounded-xl border border-accent/20 bg-card/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">Previewing this chat</p>
                        <p className="text-xs text-muted-foreground">
                          You can read what people are saying. Like the event on Discover to reply.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate("/feed")}
                        className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        Go to Discover
                      </button>
                    </div>
                  </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
                  <div className="mx-auto max-w-2xl space-y-6">
                    {messages.map((msg, i) => {
                      const sender = msg.user_id
                        ? members.find((m) => m.id === msg.user_id)
                        : undefined;
                      return (
                        <MessageBubble
                          key={msg.id}
                          senderName={msg.sender_name}
                          senderAvatarUrl={sender?.avatar_url ?? null}
                          content={msg.content}
                          isMe={msg.user_id === currentUserId && !msg.is_ai}
                          isAI={msg.is_ai}
                          timestamp={new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          index={i}
                        />
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <div className="shrink-0 border-t border-border bg-muted/25 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
                  <div className="mx-auto max-w-2xl">
                    <MentionInput options={mentionOptions} onSend={handleSend} disabled={!canReply} />
                    {!canReply && showReadOnlyDiscoverBanner && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Like this event on Discover to unlock replies and mentions.
                      </p>
                    )}
                    {!canReply && !showReadOnlyDiscoverBanner && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        You can read messages here. Like the event (on Discover) to send your own.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Desktop: members — right */}
            <aside className="order-3 hidden min-h-0 lg:order-2 lg:col-span-4 lg:flex lg:flex-col xl:col-span-3">
              <div className="flex max-h-[min(100%,calc(100svh-220px))] flex-col overflow-hidden rounded-2xl border border-border/40 bg-card p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    In this room
                  </p>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members loaded yet.</p>
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
            </aside>
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
