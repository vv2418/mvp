import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import { LogOut, ChevronRight, Settings, Bell, Shield, HelpCircle, Star, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const INTEREST_LABELS: Record<string, string> = {
  music: "Music", sports: "Sports", tech: "Tech", food: "Food & Drinks",
  art: "Art & Design", fitness: "Fitness", gaming: "Gaming", movies: "Movies & TV",
  travel: "Travel", reading: "Reading", photography: "Photography",
  networking: "Networking", dance: "Dance", outdoors: "Outdoors",
  comedy: "Comedy", volunteering: "Volunteering", startups: "Startups", cooking: "Cooking",
};

const INTEREST_EMOJIS: Record<string, string> = {
  music: "🎵", sports: "⚽", tech: "💻", food: "🍕", fitness: "💪",
  art: "🎨", comedy: "😂", dance: "💃", gaming: "🎮",
  outdoors: "🌿", networking: "🤝", startups: "🚀",
  movies: "🎬", photography: "📸", travel: "✈️", reading: "📚",
  volunteering: "❤️", cooking: "👨‍🍳",
};

const SETTINGS_ITEMS = [
  { icon: Bell, label: "Notifications", detail: "Manage alerts" },
  { icon: Shield, label: "Privacy", detail: "Control your data" },
  { icon: Settings, label: "Preferences", detail: "App settings" },
  { icon: HelpCircle, label: "Help & Support", detail: "Get assistance" },
];

interface ProfileData {
  name: string;
  avatar: string;
  memberSince: string;
  interests: string[];
  roomCount: number;
  swipeCount: number;
}

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [
        { data: profileRow },
        { data: interests },
        { data: rooms },
        { data: swipes },
      ] = await Promise.all([
        supabase.from("profiles").select("name, avatar_url, created_at").eq("id", user.id).maybeSingle(),
        supabase.from("user_interests").select("interest_id").eq("user_id", user.id),
        supabase.from("room_users").select("room_id").eq("user_id", user.id),
        supabase.from("swipes").select("id").eq("user_id", user.id).eq("direction", "right"),
      ]);

      const name = profileRow?.name || user.user_metadata?.name || "You";
      const avatar = profileRow?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
      const createdAt = profileRow?.created_at || user.created_at;
      const memberSince = new Date(createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });

      setProfile({
        name,
        avatar,
        memberSince,
        interests: (interests || []).map((i) => i.interest_id),
        roomCount: rooms?.length ?? 0,
        swipeCount: swipes?.length ?? 0,
      });
      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/");
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

  const name = profile?.name ?? "You";
  const avatar = profile?.avatar ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=Me`;

  return (
    <AppShell>
      <div className="flex flex-1 flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 lg:px-8">
          <h1 className="font-display text-xl font-bold lg:text-2xl">Profile</h1>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
          <div className="flex flex-col lg:flex-row">
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
                      src={avatar}
                      alt="Profile"
                      className="h-20 w-20 rounded-full border-4 border-card bg-secondary shadow-elevated lg:h-24 lg:w-24"
                    />
                    <div className="flex-1 pt-1">
                      <h2 className="font-display text-2xl font-bold lg:text-3xl">{name}</h2>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Joined {profile?.memberSince}</span>
                      </div>
                    </div>
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
                    { label: "Events Liked", value: profile?.swipeCount ?? 0, icon: Star },
                    { label: "Groups", value: profile?.roomCount ?? 0, icon: Users },
                    { label: "Interests", value: profile?.interests.length ?? 0, icon: Users },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl bg-card/50 border border-border/50 p-4 text-center">
                      <stat.icon className="h-4 w-4 text-muted-foreground mx-auto mb-2" />
                      <p className="font-display text-2xl font-bold">{stat.value}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    </div>
                  ))}
                </motion.div>

                {/* Interests */}
                {(profile?.interests.length ?? 0) > 0 && (
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
                      {(profile?.interests ?? []).map((id) => (
                        <span
                          key={id}
                          className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm font-medium text-foreground"
                        >
                          <span>{INTEREST_EMOJIS[id] ?? "✨"}</span>
                          {INTEREST_LABELS[id] ?? id}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Settings */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16, duration: 0.5 }}
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
                  transition={{ delay: 0.2, duration: 0.5 }}
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
