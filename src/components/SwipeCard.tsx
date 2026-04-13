import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  PanInfo,
} from "framer-motion";
import { Calendar, MapPin, MessageCircle } from "lucide-react";
import { EventData } from "@/components/EventCard";

const SWIPE_THRESHOLD = 100;
const EXIT_X = 600;

const AVATAR_COLORS = [
  "from-orange-400 to-rose-500",
  "from-violet-400 to-purple-600",
  "from-sky-400 to-blue-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
];

interface SwipeCardProps {
  event: EventData;
  onSwipe: (direction: "left" | "right") => void;
  isTop: boolean;
  index: number;
  roomId?: string | null;
  onOpenChat?: () => void;
}

const SwipeCard = ({ event, onSwipe, isTop, index, roomId, onOpenChat }: SwipeCardProps) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0.5, 1, 1, 1, 0.5]);
  const likeOpacity = useTransform(x, [0, 80, 150], [0, 0.6, 1]);
  const nopeOpacity = useTransform(x, [-150, -80, 0], [1, 0.6, 0]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const xVal = info.offset.x;
    if (Math.abs(xVal) > SWIPE_THRESHOLD) {
      const direction = xVal > 0 ? "right" : "left";
      const exitX = direction === "right" ? EXIT_X : -EXIT_X;
      animate(x, exitX, {
        duration: 0.3,
        ease: "easeOut",
        onComplete: () => onSwipe(direction),
      });
    } else {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
    }
  };

  const stackScale = Math.max(1 - index * 0.03, 0.9);
  const stackY = index * 12;
  const category = event.tags[0] ?? "";
  const attendeeCount = event.attendees;
  const avatarCount = Math.min(attendeeCount, 4);

  return (
    <motion.div
      className="absolute inset-0 touch-none"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? opacity : 1,
        scale: stackScale,
        y: stackY,
        zIndex: 10 - index,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={isTop ? handleDragEnd : undefined}
    >
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-card shadow-[0_12px_48px_rgba(232,71,10,0.08),0_4px_16px_rgba(0,0,0,0.06)] select-none">
        {/* Full image */}
        <img
          src={event.image}
          alt={event.title}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/85" />

        {/* LIKE indicator */}
        {isTop && (
          <motion.div
            className="absolute top-8 left-8 z-20 rounded-xl border-4 border-green-400 px-5 py-2 rotate-[-20deg]"
            style={{ opacity: likeOpacity }}
          >
            <span className="text-3xl font-black text-green-400 tracking-wider">LIKE</span>
          </motion.div>
        )}

        {/* NOPE indicator */}
        {isTop && (
          <motion.div
            className="absolute top-8 right-8 z-20 rounded-xl border-4 border-red-400 px-5 py-2 rotate-[20deg]"
            style={{ opacity: nopeOpacity }}
          >
            <span className="text-3xl font-black text-red-400 tracking-wider">NOPE</span>
          </motion.div>
        )}

        {/* Category chip — top right */}
        {category && (
          <div className="absolute top-5 right-5 z-10">
            <span className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-900 shadow-sm">
              {category}
            </span>
          </div>
        )}

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-6 pb-7">
          {/* Title */}
          <h2 className="mb-3 font-display text-2xl font-bold text-white leading-tight sm:text-3xl"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
            {event.title}
          </h2>

          {/* Date + preview chat row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-white/85 text-sm">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{event.date}</span>
            </div>
            {isTop && roomId && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenChat?.(); }}
                className="flex items-center gap-1 text-white/80 text-xs font-semibold hover:text-white transition-colors"
              >
                <MessageCircle className="h-3 w-3" />
                Preview event chat
              </button>
            )}
          </div>

          {/* Venue */}
          <div className="flex items-center gap-1.5 text-white/75 text-sm mb-5">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{event.location}</span>
          </div>

          {/* Attendee avatars + count */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[...Array(avatarCount)].map((_, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} border-2 border-white/80 flex items-center justify-center text-white text-[10px] font-semibold`}
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
              {attendeeCount > 4 && (
                <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/80 flex items-center justify-center text-white text-[9px] font-semibold">
                  +{attendeeCount - 4}
                </div>
              )}
            </div>
            <span className="text-white/80 text-sm font-medium">{attendeeCount} going</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeCard;
