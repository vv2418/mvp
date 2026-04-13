import { useState, useEffect } from "react";
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

  const toggleSidebar = () => {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem("sidebar_expanded", String(next));
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name = user.user_metadata?.name || "You";
      setUserName(name);
      setUserAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`);
      supabase.from("profiles").select("avatar_url, name").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data?.name) setUserName(data.name);
        if (data?.avatar_url) setUserAvatar(data.avatar_url);
      });

      (supabase.from("room_users") as unknown as { select: (cols: string) => { eq: (col: string, val: string) => Promise<{ data: Array<{ room_id: string; last_read_at: string }> | null }> } })
        .select("room_id, last_read_at")
        .eq("user_id", user.id)
        .then(({ data: memberships }) => {
          if (!memberships?.length) return;
          const checks = memberships.map(({ room_id, last_read_at }) =>
            supabase.from("messages").select("id", { count: "exact", head: true })
              .eq("room_id", room_id).eq("is_ai", false).neq("user_id", user.id).gt("created_at", last_read_at)
              .then(({ count }) => (count ?? 0) > 0)
          );
          Promise.all(checks).then((results) => setHasUnread(results.some(Boolean)));
        });
    });
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
        className={`hidden lg:flex lg:flex-col lg:border-r lg:border-border lg:bg-card/50 transition-all duration-200 ease-in-out ${expanded ? "lg:w-60" : "lg:w-20"}`}
      >
        {/* Logo */}
        <div className={`flex h-18 items-center shrink-0 ${expanded ? "px-5 gap-3" : "justify-center"}`} style={{ height: "72px" }}>
          <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-lg font-display">R</span>
          </div>
          {expanded && (
            <span className="font-display text-xl font-bold text-foreground tracking-tight truncate">Rekindled</span>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex flex-1 flex-col gap-1.5 py-4 ${expanded ? "px-4" : "px-3"}`}>
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path || (path === "/rooms" && location.pathname.startsWith("/chat"));
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                title={!expanded ? label : undefined}
                className={`flex items-center rounded-xl transition-all ${
                  expanded ? "gap-3 px-3 py-3.5" : "justify-center py-3.5"
                } ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
              >
                <span className="relative shrink-0">
                  <Icon className={`h-6 w-6 ${active ? "stroke-[2]" : "stroke-[1.5]"}`} />
                  {path === "/rooms" && hasUnread && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent" />
                  )}
                </span>
                {expanded && <span className="text-sm font-semibold truncate">{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Expand/collapse toggle */}
        <div className={`border-t border-border py-4 ${expanded ? "px-4" : "px-3"}`}>
          <button
            onClick={toggleSidebar}
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className={`flex items-center rounded-xl py-3 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all ${expanded ? "gap-3 px-3 w-full" : "justify-center w-full"}`}
          >
            {expanded
              ? <><ChevronLeft className="h-5 w-5 shrink-0" /><span className="text-sm font-semibold">Collapse</span></>
              : <ChevronRight className="h-5 w-5" />
            }
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">

        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <a href="/" className="font-display text-lg font-bold text-foreground tracking-tight">Rekindled</a>
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
