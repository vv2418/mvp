import { useState, useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  PanInfo,
} from "framer-motion";
import { Calendar, MapPin, Users } from "lucide-react";
import { EventData } from "@/components/EventCard";

const SWIPE_THRESHOLD = 100;
const EXIT_X = 600;

interface SwipeCardProps {
  event: EventData;
  onSwipe: (direction: "left" | "right") => void;
  isTop: boolean;
  index: number;
}

const SwipeCard = ({ event, onSwipe, isTop, index }: SwipeCardProps) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0.5, 1, 1, 1, 0.5]);

  // Overlay indicators
  const likeOpacity = useTransform(x, [0, 80, 150], [0, 0.6, 1]);
  const nopeOpacity = useTransform(x, [-150, -80, 0], [1, 0.6, 0]);

  const handleDragEnd = (_: any, info: PanInfo) => {
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

  // Stack offset for cards behind
  const stackScale = Math.max(1 - index * 0.04, 0.9);
  const stackY = index * 8;

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
      <div className="relative h-full w-full overflow-hidden rounded-3xl border border-border/40 bg-card shadow-elevated select-none">
        {/* Full image background */}
        <img
          src={event.image}
          alt={event.title}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

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

        {/* Attendees badge */}
        <div className="absolute top-5 right-5 z-10 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white">
          <Users className="h-3 w-3" />
          {event.attendees} going
        </div>

        {/* Bottom content overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-6 pb-7">
          {/* Tags */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/15 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-white/90"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h2 className="mb-1 font-display text-2xl font-bold text-white leading-tight sm:text-3xl">
            {event.title}
          </h2>

          {/* Meta */}
          <div className="mb-2 flex items-center gap-4 text-sm text-white/70">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {event.date}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {event.location}
            </span>
          </div>

          {/* Description */}
          <p className="line-clamp-2 text-sm text-white/60 leading-relaxed">
            {event.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeCard;
