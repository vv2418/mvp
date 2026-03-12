import { useLocation, useNavigate } from "react-router-dom";
import { Flame, MessageCircle, Search, Bell, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const NAV_ITEMS = [
  { path: "/feed", icon: Flame, label: "Discover" },
  { path: "/rooms", icon: MessageCircle, label: "Chats" },
];

const MOCK_USER = {
  name: "You",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Me",
};

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-[100svh] overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-[260px] lg:flex-col lg:border-r lg:border-border lg:bg-card/50">
        <div className="flex h-16 items-center px-6">
          <a href="/" className="font-display text-xl font-bold text-foreground tracking-tight">
            Rekindled
          </a>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path || (path === "/rooms" && location.pathname.startsWith("/chat"));
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2]" : "stroke-[1.5]"}`} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar bottom: theme + profile */}
        <div className="border-t border-border px-3 py-4 space-y-2">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all"
          >
            {theme === "dark" ? <Sun className="h-5 w-5 stroke-[1.5]" /> : <Moon className="h-5 w-5 stroke-[1.5]" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            onClick={() => navigate("/profile")}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
              location.pathname === "/profile"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            }`}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={MOCK_USER.avatar} alt="Profile" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            My Profile
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <a href="/" className="font-display text-lg font-bold text-foreground tracking-tight">
            Rekindled
          </a>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary transition-colors">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="ring-2 ring-accent/50 rounded-full transition-transform hover:scale-105"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={MOCK_USER.avatar} alt="Profile" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </button>
          </div>
        </div>

        {children}
      </main>

      {/* Mobile bottom nav — hidden on chat pages */}
      {!location.pathname.startsWith("/chat") && (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path || (path === "/rooms" && location.pathname.startsWith("/chat"));
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`relative flex flex-col items-center gap-1 px-6 py-1.5 transition-all ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-[22px] w-[22px] transition-all ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
                <span className={`text-[10px] font-medium transition-all ${active ? "opacity-100" : "opacity-60"}`}>{label}</span>
                {active && (
                  <span className="absolute -top-0.5 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-foreground" />
                )}
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
