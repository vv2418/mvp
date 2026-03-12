import { motion } from "framer-motion";
import { X, MapPin } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MemberProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  interests: string[];
}

interface MemberProfileSheetProps {
  member: MemberProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

const MemberProfileSheet = ({ member, open, onOpenChange }: MemberProfileSheetProps) => {
  if (!member) return null;

  const avatarUrl = member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:w-[400px] bg-background border-border p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="sr-only">{member.name}'s Profile</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col items-center px-6 pt-4 pb-8">
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={avatarUrl}
              alt={member.name}
              className="h-24 w-24 rounded-full border-4 border-card bg-secondary shadow-elevated"
            />
          </motion.div>

          {/* Name */}
          <h2 className="mt-4 font-display text-xl font-bold text-foreground">
            {member.name}
          </h2>

          {/* Interests */}
          {member.interests.length > 0 ? (
            <div className="mt-6 w-full">
              <h3 className="mb-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
                Interests
              </h3>
              <div className="flex flex-wrap gap-2">
                {member.interests.map((interest) => (
                  <span
                    key={interest}
                    className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-3.5 py-2 text-sm font-medium text-foreground"
                  >
                    <span>{INTEREST_EMOJIS[interest] || "✨"}</span>
                    {INTEREST_LABELS[interest] || interest}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              No interests shared yet
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MemberProfileSheet;
