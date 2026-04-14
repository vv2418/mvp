import { motion } from "framer-motion";
import { MessageCircle, Sparkles, Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MemberProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  interests: string[];
}

interface MemberProfileSheetProps {
  member: MemberProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Event title for this room — shown as context under the name */
  eventTitle?: string;
}

const INTEREST_LABELS: Record<string, string> = {
  music: "Live Music",
  sports: "Sports",
  tech: "Tech",
  food: "Food & Drinks",
  art: "Art & Culture",
  fitness: "Wellness",
  gaming: "Gaming",
  movies: "Film",
  travel: "Travel",
  reading: "Reading",
  photography: "Photography",
  networking: "Networking",
  dance: "Dance",
  outdoors: "Outdoor Activities",
  comedy: "Comedy",
  volunteering: "Volunteering",
  startups: "Startups",
  cooking: "Cooking",
};

const MemberProfileSheet = ({
  member,
  open,
  onOpenChange,
  eventTitle,
}: MemberProfileSheetProps) => {
  if (!member) return null;

  const avatarUrl =
    member.avatar_url ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.id)}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-border bg-background p-0 sm:max-w-[440px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{member.name}</SheetTitle>
          <SheetDescription>
            Profile details for a member of this event chat.
          </SheetDescription>
        </SheetHeader>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pt-14">
          <div className="relative shrink-0 overflow-hidden pb-4">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/25 via-accent/10 to-background"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-accent/15 blur-3xl"
              aria-hidden
            />
            <div className="relative z-[1] flex flex-col items-center px-8 pb-2 text-center">
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="relative"
              >
                <div
                  className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent/40 to-accent/5 opacity-60 blur-sm"
                  aria-hidden
                />
                <img
                  src={avatarUrl}
                  alt={member.name}
                  className="relative h-[7.5rem] w-[7.5rem] rounded-2xl border-4 border-card bg-secondary object-cover shadow-elevated"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-6 flex flex-col items-center gap-2"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-sm backdrop-blur-sm">
                  <Users className="h-3 w-3 text-accent" />
                  Room member
                </span>
                <h2
                  className="max-w-[16rem] text-balance text-3xl font-semibold leading-tight text-foreground sm:max-w-none sm:text-4xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {member.name}
                </h2>
                {eventTitle ? (
                  <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground/80">Same event · </span>
                    <span className="line-clamp-2">{eventTitle}</span>
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
                    Going with you in this chat
                  </p>
                )}
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative z-[2] mx-5 mb-4 rounded-2xl border border-border/60 bg-card p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              About
            </p>
            {member.bio?.trim() ? (
              <p className="text-sm leading-relaxed text-foreground">{member.bio.trim()}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No bio on their profile yet.</p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="relative z-[2] mx-5 -mt-1 mb-4 flex-1 rounded-2xl border border-border/60 bg-card p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
          >
            <div className="mb-4 flex items-center gap-2 border-b border-border/50 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Interests
                </p>
                <p className="text-xs text-muted-foreground">From their profile</p>
              </div>
            </div>

            {member.interests.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {member.interests.map((interest, i) => (
                  <motion.span
                    key={interest}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.04 * i }}
                    className="rounded-full bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent"
                  >
                    {INTEREST_LABELS[interest] ?? interest}
                  </motion.span>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">No interests listed yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  They have not added interests to their profile.
                </p>
              </div>
            )}
          </motion.div>

          <div className="mt-auto border-t border-border/60 bg-muted/20 px-6 py-5">
            <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/80 p-4 shadow-card">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/5">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold text-foreground">Say hi in the room</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Type{" "}
                  <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">
                    @
                  </kbd>{" "}
                  in the composer and pick their name, or write{" "}
                  <kbd className="max-w-full break-all rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    @{member.name}
                  </kbd>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MemberProfileSheet;
