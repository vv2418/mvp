import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Flame, MessageCircle, CalendarDays, Bell, X, ChevronRight, ChevronLeft } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

const NAV_ITEMS = [
  { path: "/feed", icon: Flame, label: "Discover" },
  { path: "/calendar", icon: CalendarDays, label: "Calendar" },
  { path: "/rooms", icon: MessageCircle, label: "Chats" },
];

const PUSH_DISMISSED_KEY = "push_prompt_dismissed";

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userAvatar, setUserAvatar] = useState<string>("");
  const [userName, setUserName] = useState<string>("You");
  const [hasUnread, setHasUnread] = useState(false);
  const { supported: pushSupported, permission, subscribe } = usePushNotifications();
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [expanded, setExpanded] = useState(() => localStorage.getItem("sidebar_expanded") !== "false");
  /** Labels animate out before width shrinks on collapse — avoids a hollow wide rail + layout snap. */
  const [labelsVisible, setLabelsVisible] = useState(() => localStorage.getItem("sidebar_expanded") !== "false");
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const LABEL_HIDE_MS = 220;

  const toggleSidebar = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    if (expanded) {
      // Collapse: hide labels first, then shrink width after animation
      setLabelsVisible(false);
      collapseTimerRef.current = setTimeout(() => {
        collapseTimerRef.current = null;
        setExpanded(false);
        localStorage.setItem("sidebar_expanded", "false");
      }, LABEL_HIDE_MS);
    } else {
      // Expand: grow width immediately, then show labels after width starts moving
      setExpanded(true);
      localStorage.setItem("sidebar_expanded", "true");
      collapseTimerRef.current = setTimeout(() => {
        collapseTimerRef.current = null;
        setLabelsVisible(true);
      }, 120);
    }
  };

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let userId: string | null = null;

    const checkUnread = async (uid: string) => {
      const { data: memberships } = await (supabase.from("room_users") as any)
        .select("room_id, last_read_at")
        .eq("user_id", uid) as { data: Array<{ room_id: string; last_read_at: string }> | null };
      if (!memberships?.length) return;
      const checks = memberships.map(({ room_id, last_read_at }) =>
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("room_id", room_id).neq("user_id", uid).gt("created_at", last_read_at)
          .then(({ count }) => (count ?? 0) > 0)
      );
      const results = await Promise.all(checks);
      setHasUnread(results.some(Boolean));
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      userId = user.id;
      const name = user.user_metadata?.name || "You";
      setUserName(name);
      setUserAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`);
      supabase.from("profiles").select("avatar_url, name").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data?.name) setUserName(data.name);
        if (data?.avatar_url) setUserAvatar(data.avatar_url);
      });
      checkUnread(user.id);
    });

    // Re-check unread whenever a new message lands in any room
    const channel = supabase
      .channel("appshell-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        if (userId) checkUnread(userId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (pushSupported && permission === "default" && !localStorage.getItem(PUSH_DISMISSED_KEY)) {
      const t = setTimeout(() => setShowPushBanner(true), 2000);
      return () => clearTimeout(t);
    }
  }, [pushSupported, permission]);

  const handleEnablePush = async () => {
    setShowPushBanner(false);
    localStorage.setItem(PUSH_DISMISSED_KEY, "1");
    const ok = await subscribe();
    toast[ok ? "success" : "error"](ok ? "Push notifications enabled" : "Permission denied");
  };

  const handleDismissPush = () => {
    setShowPushBanner(false);
    localStorage.setItem(PUSH_DISMISSED_KEY, "1");
  };

  useEffect(() => {
    if (location.pathname.startsWith("/rooms") || location.pathname.startsWith("/chat")) {
      setHasUnread(false);
    }
  }, [location.pathname]);

  return (
    <div className="flex h-[100svh] overflow-hidden">

      {/* ── Desktop sidebar ──────────────────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:border-r lg:border-border lg:bg-background lg:shrink-0 transition-[width] duration-[320ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${expanded ? "lg:w-56" : "lg:w-20"}`}
      >
        {/* Logo */}
        <button
          onClick={() => navigate("/feed")}
          className="flex items-center shrink-0 gap-3 px-6 py-8 mb-10 transition-opacity hover:opacity-90"
          aria-label="Go to Discover"
        >
          <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-heading)' }}>R</span>
          </div>
          <span
            className={`min-w-0 overflow-hidden whitespace-nowrap font-bold tracking-tight text-foreground transition-[opacity,max-width] ease-[cubic-bezier(0.33,1,0.68,1)] ${
              labelsVisible ? "max-w-[10rem] opacity-100" : "max-w-0 opacity-0"
            }`}
            style={{ fontFamily: "var(--font-heading)", fontSize: "1.2rem", transitionDuration: `${LABEL_HIDE_MS}ms` }}
            aria-hidden={!labelsVisible}
          >
            Rekindled
          </span>
        </button>

        {/* Nav — evenly spread with gap-6 like Figma */}
        <nav className="flex flex-1 flex-col gap-6 px-4">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path || (path === "/rooms" && location.pathname.startsWith("/chat"));
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                title={!expanded ? label : undefined}
                className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-[color,background-color] duration-200 ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span className="relative shrink-0">
                  <Icon size={20} />
                  {path === "/rooms" && hasUnread && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent" />
                  )}
                </span>
                <span
                  className={`min-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-[opacity,max-width] ease-[cubic-bezier(0.33,1,0.68,1)] ${
                    labelsVisible ? "max-w-[9rem] opacity-100" : "max-w-0 opacity-0"
                  }`}
                  style={{ transitionDuration: `${LABEL_HIDE_MS}ms` }}
                  aria-hidden={!labelsVisible}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Expand/collapse toggle */}
        <div className="border-t border-border px-4 py-6">
          <button
            onClick={toggleSidebar}
            title={labelsVisible ? "Collapse sidebar" : "Expand sidebar"}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-muted-foreground transition-[color,background-color] duration-200 hover:bg-muted hover:text-foreground"
          >
            <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
              <ChevronLeft
                className={`absolute h-5 w-5 transition-opacity duration-300 ${expanded ? "opacity-100" : "opacity-0"}`}
                aria-hidden={!expanded}
              />
              <ChevronRight
                className={`absolute h-5 w-5 transition-opacity duration-300 ${expanded ? "opacity-0" : "opacity-100"}`}
                aria-hidden={expanded}
              />
            </span>
            <span
              className={`min-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-[opacity,max-width] ease-[cubic-bezier(0.33,1,0.68,1)] ${
                labelsVisible ? "max-w-[6rem] opacity-100" : "max-w-0 opacity-0"
              }`}
              style={{ transitionDuration: `${LABEL_HIDE_MS}ms` }}
              aria-hidden={!labelsVisible}
            >
              Collapse
            </span>
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">

        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <button onClick={() => navigate("/feed")} className="font-display text-lg font-bold text-foreground tracking-tight">Rekindled</button>
          <button onClick={() => navigate("/profile")} className="ring-2 ring-accent/50 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          </button>
        </div>

        {/* Push notification permission banner */}
        {showPushBanner && (
          <div className="flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
              <Bell className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Stay in the loop</p>
              <p className="text-[11px] text-muted-foreground">Get notified when your group chats are active</p>
            </div>
            <button onClick={handleEnablePush} className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
              Enable
            </button>
            <button onClick={handleDismissPush} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {children}
      </main>

      {/* Mobile bottom nav */}
      {!location.pathname.startsWith("/chat") && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/90 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-md items-center justify-around py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
              const active = location.pathname === path || (path === "/rooms" && location.pathname.startsWith("/chat"));
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`relative flex flex-col items-center gap-1 px-6 py-1.5 transition-all ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="relative">
                    <Icon className={`h-[22px] w-[22px] transition-all ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
                    {path === "/rooms" && hasUnread && (
                      <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-accent" />
                    )}
                  </span>
                  <span className={`text-[10px] font-medium transition-all ${active ? "opacity-100" : "opacity-60"}`}>{label}</span>
                  {active && <span className="absolute -top-0.5 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-foreground" />}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default AppShell;
