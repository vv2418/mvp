import { motion } from "framer-motion";
import { Calendar, MapPin, Users, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EventData {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  attendees: number;
  image: string;
  tags: string[];
}

interface EventCardProps {
  event: EventData;
  onJoin: (id: string) => void;
  onPass: (id: string) => void;
  index: number;
}

const EventCard = ({ event, onJoin, onPass, index }: EventCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-elevated hover:border-border/80"
    >
      {/* Image section */}
      <div className="relative h-48 overflow-hidden sm:h-56">
        <img
          src={event.image}
          alt={event.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/10 to-transparent" />

        {/* Tags overlay */}
        <div className="absolute bottom-3 left-4 flex gap-1.5">
          {event.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-background/90 backdrop-blur-sm px-3 py-1 text-[11px] font-semibold text-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Attendees badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold text-foreground">
          <Users className="h-3 w-3" />
          {event.attendees} going
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="mb-1.5 font-display text-lg font-bold text-foreground leading-tight">
          {event.title}
        </h3>
        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
          {event.description}
        </p>

        {/* Meta row */}
        <div className="mb-5 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {event.date}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {event.location}
          </span>
        </div>

        {/* Action buttons — webapp style */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onJoin(event.id)}
            className="flex-1 rounded-xl bg-accent text-accent-foreground font-semibold shadow-none transition-all hover:bg-accent/90 hover:shadow-card"
            size="sm"
          >
            Join hang
            <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
          <Button
            onClick={() => onPass(event.id)}
            variant="outline"
            className="rounded-xl border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            size="sm"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Pass
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default EventCard;
