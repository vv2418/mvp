import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  PanInfo,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, MapPin } from "lucide-react";
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
  /** Rekindle chat room id when one exists for this event */
  roomId?: string | null;
  /** People currently in that in-app group chat */
  roomMemberCount?: number;
  onOpenChat?: () => void;
}

const SwipeCard = ({
  event,
  onSwipe,
  isTop,
  index,
  roomId,
  roomMemberCount = 0,
  onOpenChat,
}: SwipeCardProps) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0.5, 1, 1, 1, 0.5]);
  const likeOpacity = useTransform(x, [0, 80, 150], [0, 0.6, 1]);
  const nopeOpacity = useTransform(x, [-150, -80, 0], [1, 0.6, 0]);

  const [stayPanelOpen, setStayPanelOpen] = useState(false);
  const coarsePointerRef = useRef(false);
  const cornerWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    coarsePointerRef.current = window.matchMedia("(pointer: coarse)").matches;
  }, []);

  useEffect(() => {
    if (!stayPanelOpen || !coarsePointerRef.current) return;
    const close = (e: PointerEvent) => {
      if (cornerWrapRef.current && !cornerWrapRef.current.contains(e.target as Node)) {
        setStayPanelOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [stayPanelOpen]);

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

  const onCornerPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const stackScale = Math.max(1 - index * 0.03, 0.9);
  const stackY = index * 12;
  const category = event.tags[0] ?? "";
  const hasRoom = Boolean(roomId);
  const avatarSlots = Math.min(roomMemberCount, 4);

  const goingLabel =
    roomMemberCount === 0
      ? "0 going, no one's in the chat yet"
      : `${roomMemberCount} going`;

  const showChatActions = isTop;

  /** Partiful-style pill on photo — always light chip + dark label (ignore global theme text color) */
  const previewChatPillClass =
    "font-body inline-flex shrink-0 items-center justify-center rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-medium text-gray-950 shadow-[0_2px_14px_rgba(0,0,0,0.18)] transition hover:bg-white/95 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

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
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-card shadow-[0_4px_24px_rgba(0,0,0,0.10)] select-none">
        <img
          src={event.image}
          alt={event.title}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/85" />

        {isTop && (
          <motion.div
            className="absolute top-8 left-8 z-20 rounded-xl border-4 border-green-400 px-5 py-2 rotate-[-20deg]"
            style={{ opacity: likeOpacity }}
          >
            <span className="text-3xl font-black text-green-400 tracking-wider">LIKE</span>
          </motion.div>
        )}

        {isTop && (
          <motion.div
            className="absolute top-8 right-8 z-20 rounded-xl border-4 border-red-400 px-5 py-2 rotate-[20deg]"
            style={{ opacity: nopeOpacity }}
          >
            <span className="text-3xl font-black text-red-400 tracking-wider">NOPE</span>
          </motion.div>
        )}

        {category && (
          <div className="absolute top-5 right-5 z-10 max-w-[calc(100%-5rem)]">
            <span className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-900 shadow-sm">
              {category}
            </span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-10 p-5 pb-6 sm:p-6 sm:pb-7">
          <h2
            className="mb-2 font-display text-2xl font-bold text-white leading-tight sm:text-3xl pr-2"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
          >
            {event.title}
          </h2>

          <div className="flex items-center gap-1.5 text-white/85 text-sm mb-2">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{event.date}</span>
          </div>

          <div className="flex items-start gap-1.5 text-white/75 text-sm mb-4">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{event.location}</span>
          </div>

          {/* Bottom row: subtle left status + corner preview */}
          <div className="flex items-end justify-between gap-3 min-h-[2.5rem]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex -space-x-2 shrink-0">
                {avatarSlots > 0 ? (
                  [...Array(avatarSlots)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-7 h-7 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} border-2 border-white/80 flex items-center justify-center text-white text-[10px] font-semibold`}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-dashed border-white/40 bg-white/10" />
                )}
                {roomMemberCount > 4 && (
                  <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/80 flex items-center justify-center text-white text-[9px] font-semibold">
                    +{roomMemberCount - 4}
                  </div>
                )}
              </div>
              <span className="font-body text-white/90 text-xs sm:text-sm font-medium leading-snug">{goingLabel}</span>
            </div>

            {showChatActions && !hasRoom && (
              <div
                ref={cornerWrapRef}
                className="relative shrink-0"
                onPointerDown={onCornerPointerDown}
                onMouseEnter={() => {
                  if (!coarsePointerRef.current) setStayPanelOpen(true);
                }}
                onMouseLeave={() => {
                  if (!coarsePointerRef.current) setStayPanelOpen(false);
                }}
              >
                <button
                  type="button"
                  aria-expanded={stayPanelOpen}
                  aria-label="Preview chat — how Rekindle groups work"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (coarsePointerRef.current) setStayPanelOpen((v) => !v);
                  }}
                  className={previewChatPillClass}
                >
                  Preview chat
                </button>

                <div
                  role="tooltip"
                  className={`absolute bottom-full right-0 z-30 w-[min(288px,calc(100vw-4rem))] rounded-2xl border border-white/20 bg-black/85 px-4 py-3 text-left font-body shadow-2xl backdrop-blur-md transition-all duration-200 ${
                    stayPanelOpen
                      ? "visible translate-y-0 opacity-100 pointer-events-auto"
                      : "invisible translate-y-1 opacity-0 pointer-events-none"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">Stay tuned</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/80">
                    More people like you will join — then the Rekindle group chat opens here. Swipe right to get it
                    started.
                  </p>
                </div>
              </div>
            )}

            {showChatActions && hasRoom && (
              <div className="shrink-0" onPointerDown={onCornerPointerDown}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChat?.();
                  }}
                  className={previewChatPillClass}
                >
                  Preview chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeCard;
