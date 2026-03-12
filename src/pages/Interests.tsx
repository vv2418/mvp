import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const INTERESTS = [
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "tech", label: "Tech", emoji: "💻" },
  { id: "food", label: "Food & Drinks", emoji: "🍕" },
  { id: "art", label: "Art & Design", emoji: "🎨" },
  { id: "fitness", label: "Fitness", emoji: "💪" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "movies", label: "Movies & TV", emoji: "🎬" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "reading", label: "Reading", emoji: "📚" },
  { id: "photography", label: "Photography", emoji: "📸" },
  { id: "networking", label: "Networking", emoji: "🤝" },
  { id: "dance", label: "Dance", emoji: "💃" },
  { id: "outdoors", label: "Outdoors", emoji: "🏔️" },
  { id: "comedy", label: "Comedy", emoji: "😂" },
  { id: "volunteering", label: "Volunteering", emoji: "❤️" },
  { id: "startups", label: "Startups", emoji: "🚀" },
  { id: "cooking", label: "Cooking", emoji: "👨‍🍳" },
];

const Interests = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const navigate = useNavigate();

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (selected.length < 3) {
      toast.error("Pick at least 3 interests");
      return;
    }
    localStorage.setItem("rekindle_interests", JSON.stringify(selected));

    // Save interests to DB
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Clear existing and insert new
      await supabase.from("user_interests").delete().eq("user_id", user.id);
      const rows = selected.map((id) => ({ user_id: user.id, interest_id: id }));
      await supabase.from("user_interests").insert(rows);
    }

    navigate("/feed");
  };

  return (
    <div className="relative flex min-h-[100svh] flex-col bg-background overflow-hidden">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -right-20 h-[500px] w-[500px] rounded-full bg-accent/[0.12] blur-[100px]" />
        <div className="absolute top-1/3 -left-40 h-[400px] w-[400px] rounded-full bg-accent/[0.08] blur-[80px]" />
        <div className="absolute bottom-10 right-1/4 h-[350px] w-[350px] rounded-full bg-primary/[0.06] blur-[90px]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      </div>
      <div className="flex-1 px-6 py-14 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
          className="mx-auto w-full max-w-lg"
        >
          <span className="mb-4 inline-block border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Step 2 of 2
          </span>
          <h1 className="mb-3 font-display text-4xl font-bold sm:text-5xl">
            What are you into?
          </h1>
          <p className="mb-12 text-muted-foreground text-lg">
            Pick at least 3 so we can find your people.
          </p>

          <div className="mb-12 flex flex-wrap gap-3">
            {INTERESTS.map((interest, i) => {
              const isSelected = selected.includes(interest.id);
              return (
                <motion.button
                  key={interest.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02, duration: 0.3 }}
                  onClick={() => toggle(interest.id)}
                  className={`relative flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium transition-all ${
                    isSelected
                      ? "border-foreground bg-foreground text-primary-foreground shadow-card"
                      : "border-border bg-card/50 text-foreground hover:border-foreground/20 hover:bg-card"
                  }`}
                >
                  <span className="text-base">{interest.emoji}</span>
                  <span>{interest.label}</span>
                  {isSelected && (
                    <Check className="ml-1 h-3.5 w-3.5" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur-xl px-6 py-5">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selected.length} selected
          </span>
          <Button
            className="rounded-full bg-foreground px-8 py-6 font-semibold text-primary-foreground hover:opacity-90"
            onClick={handleContinue}
            disabled={selected.length < 3}
          >
            Continue
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Interests;
