import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Sparkles, Loader2 } from "lucide-react";
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

const Chat = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
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

      // Check if user can participate: swiped right OR is already a room member
      const [{ data: likedSwipe }, { data: membership }] = await Promise.all([
        supabase
          .from("swipes")
          .select("id")
          .eq("user_id", user.id)
          .eq("event_id", room.event_id)
          .eq("direction", "right")
          .maybeSingle(),
        supabase
          .from("room_users")
          .select("user_id")
          .eq("room_id", roomId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      const canParticipate = Boolean(likedSwipe) || Boolean(membership);
      setCanReply(canParticipate);

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

      // Load members for anyone who can participate (swiped right or is a member)
      if (canParticipate) {
        const { data: roomMembers } = await supabase
          .from("room_users")
          .select("user_id")
          .eq("room_id", roomId);

        if (roomMembers && roomMembers.length > 0) {
          const userIds = roomMembers.map((m) => m.user_id);
          const [{ data: profiles }, { data: interests }] = await Promise.all([
            supabase.from("profiles").select("id, name, avatar_url").in("id", userIds),
            supabase.from("user_interests").select("user_id, interest_id").in("user_id", userIds),
          ]);

          const interestMap: Record<string, string[]> = {};
          for (const i of interests || []) {
            if (!interestMap[i.user_id]) interestMap[i.user_id] = [];
            interestMap[i.user_id].push(i.interest_id);
          }

          setMembers(
            (profiles || []).map((p) => ({
              id: p.id,
              name: p.name || "Anonymous",
              avatar_url: p.avatar_url,
              interests: interestMap[p.id] || [],
            }))
          );
        } else {
          setMembers([]);
        }
      } else {
        setMembers([]);
      }

      setLoading(false);
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
      await supabase.functions.invoke("chat-ai", {
        body: {
          room_id: roomId,
          event_title: roomTitle,
          user_id: currentUserId,
          mode: "revive",
          idle_after_minutes: CHAT_IDLE_MINUTES,
        },
      });
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

  const handleSend = async (text: string) => {
    if (!roomId || !currentUserId) return;
    if (!canReply) {
      toast.error("Like this event first if you want to reply");
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

    // Get recent messages for AI context
    const recentMsgs = messages.slice(-10).concat({ id: "temp", user_id: currentUserId, sender_name: currentUserName, content: text, is_ai: false, created_at: new Date().toISOString() });

    // Trigger AI rage-bait response via edge function
    supabase.functions.invoke("chat-ai", {
      body: {
        room_id: roomId,
        event_title: roomTitle,
        recent_messages: recentMsgs.map(m => ({ sender_name: m.sender_name, content: m.content })),
        user_id: currentUserId,
      },
    }).catch(err => console.error("AI response error:", err));
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
        <div className="flex flex-1 items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-1 flex-col bg-background min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-4 lg:px-8">
          <button onClick={() => navigate("/rooms")} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary transition-colors lg:hidden">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-[15px] text-foreground truncate">{roomTitle}</h2>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {members.length} members
            </span>
          </div>
        </div>

        {/* Members bar */}
        <div className="border-b border-border px-4 py-3 lg:px-8">
          <p className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
            Members
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {members.map((member) => {
              const avatarUrl = member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`;
              return (
                <button
                  key={member.id}
                  onClick={() => handleMemberClick(member)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
                >
                  <div className="relative">
                    <img
                      src={avatarUrl}
                      alt={member.name}
                      className="h-10 w-10 rounded-full bg-secondary border-2 border-transparent group-hover:border-accent/50 transition-all"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors max-w-[56px] truncate">
                    {member.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {!canReply && (
          <div className="border-b border-border bg-accent/5 px-4 py-3 lg:px-8">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl border border-accent/15 bg-card/80 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Read-only preview</p>
                <p className="text-xs text-muted-foreground">
                  You can follow the conversation, but only people who liked this event can reply.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/feed")}
                className="shrink-0 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Go like it
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-6 lg:px-8">
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                senderName={msg.sender_name}
                content={msg.content}
                isMe={msg.user_id === currentUserId && !msg.is_ai}
                isAI={msg.is_ai}
                timestamp={new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                index={i}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-xl px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:px-8">
          <div className="mx-auto max-w-2xl">
            <MentionInput options={mentionOptions} onSend={handleSend} disabled={!canReply} />
            {!canReply && (
              <p className="mt-2 text-xs text-muted-foreground">
                This event chat is public to view. Replies unlock after you like the event.
              </p>
            )}
          </div>
        </div>

        <MemberProfileSheet
          member={selectedMember}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />
      </div>
    </AppShell>
  );
};

export default Chat;
