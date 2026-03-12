import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import { LogOut, ChevronRight, Settings, Bell, Shield, HelpCircle, Star, Calendar, Users, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const MOCK_PROFILE = {
  name: "You",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Me",
  bio: "Music lover. Foodie. Always up for an adventure.",
  location: "San Francisco, CA",
  memberSince: "March 2026",
  interests: ["Music", "Tech", "Food & Drinks", "Startups", "Photography", "Outdoors"],
  stats: { hangs: 3, groups: 2, connections: 12 },
  eventsAttended: [
    { title: "Jazz Night", date: "Feb 28", emoji: "🎵", location: "The Basement" },
    { title: "AI Meetup", date: "Mar 5", emoji: "💻", location: "TechHub" },
    { title: "Food Truck Rally", date: "Mar 10", emoji: "🍕", location: "Downtown" },
  ],
  badges: [
    { label: "Early Adopter", emoji: "🌟" },
    { label: "Social Butterfly", emoji: "🦋" },
    { label: "Foodie", emoji: "🍜" },
  ],
};

const SETTINGS_ITEMS = [
  { icon: Bell, label: "Notifications", detail: "Manage alerts" },
  { icon: Shield, label: "Privacy", detail: "Control your data" },
  { icon: Settings, label: "Preferences", detail: "App settings" },
  { icon: HelpCircle, label: "Help & Support", detail: "Get assistance" },
];

const Profile = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/");
  };

  return (
    <AppShell>
      <div className="flex flex-1 flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 lg:px-8">
          <h1 className="font-display text-xl font-bold lg:text-2xl">Profile</h1>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
          <div className="flex flex-col lg:flex-row">
            {/* Left column: Profile info */}
            <div className="flex-1 px-6 lg:px-8">
              <div className="mx-auto max-w-2xl">
                {/* Avatar & name card */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
                  className="relative mt-6 rounded-2xl border border-border bg-card/50 p-6"
                >
                  <div className="flex items-start gap-5">
                    <img
                      src={MOCK_PROFILE.avatar}
                      alt="Profile"
                      className="h-20 w-20 rounded-full border-4 border-card bg-secondary shadow-elevated lg:h-24 lg:w-24"
                    />
                    <div className="flex-1 pt-1">
                      <h2 className="font-display text-2xl font-bold lg:text-3xl">{MOCK_PROFILE.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{MOCK_PROFILE.bio}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{MOCK_PROFILE.location}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Joined {MOCK_PROFILE.memberSince}</span>
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="mt-4 flex gap-2">
                    {MOCK_PROFILE.badges.map((badge) => (
                      <span
                        key={badge.label}
                        className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground"
                      >
                        {badge.emoji} {badge.label}
                      </span>
                    ))}
                  </div>
                </motion.div>

                {/* Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, duration: 0.5 }}
                  className="mt-4 grid grid-cols-3 gap-3"
                >
                  {[
                    { label: "Hangs", value: MOCK_PROFILE.stats.hangs, icon: Star },
                    { label: "Groups", value: MOCK_PROFILE.stats.groups, icon: Users },
                    { label: "Connections", value: MOCK_PROFILE.stats.connections, icon: Users },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl bg-card/50 border border-border/50 p-4 text-center">
                      <stat.icon className="h-4 w-4 text-muted-foreground mx-auto mb-2" />
                      <p className="font-display text-2xl font-bold">{stat.value}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    </div>
                  ))}
                </motion.div>

                {/* Interests */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.5 }}
                  className="mt-6"
                >
                  <h3 className="mb-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
                    Interests
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {MOCK_PROFILE.interests.map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-foreground"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </motion.div>

                {/* Past events */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16, duration: 0.5 }}
                  className="mt-6"
                >
                  <h3 className="mb-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
                    Recent Hangs
                  </h3>
                  <div className="space-y-2">
                    {MOCK_PROFILE.eventsAttended.map((event) => (
                      <div
                        key={event.title}
                        className="flex items-center gap-4 rounded-2xl bg-card/50 border border-border/50 p-4"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-lg">
                          {event.emoji}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground text-[15px]">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{event.date} · {event.location}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Settings */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="mt-6"
                >
                  <h3 className="mb-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
                    Settings
                  </h3>
                  <div className="space-y-1">
                    {SETTINGS_ITEMS.map((item) => (
                      <button
                        key={item.label}
                        className="flex w-full items-center gap-4 rounded-xl p-3 text-left transition-colors hover:bg-secondary/30"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                          <item.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{item.detail}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Sign out */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.24, duration: 0.5 }}
                  className="mt-6 mb-6"
                >
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-2xl bg-card/50 border border-border/50 p-4 text-left transition-colors hover:bg-secondary/30"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                      <LogOut className="h-5 w-5 text-destructive" />
                    </div>
                    <span className="font-medium text-destructive">Sign out</span>
                  </button>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Profile;
