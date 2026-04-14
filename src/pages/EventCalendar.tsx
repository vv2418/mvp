import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Users, Heart, Sparkles, Clock, X, ArrowLeft } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import AppShell from '@/components/AppShell';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { REKINDLE_LIKED_EVENTS_CHANGED } from '@/lib/rekindle-events';
import { CountUpValue } from '@/components/CountUpValue';

const TM_API_KEY = import.meta.env.VITE_TICKETMASTER_API_KEY;

type EventMeta = { name: string; localDate?: string };

async function resolveEventMetaById(eventIds: string[]): Promise<Record<string, EventMeta>> {
  if (!TM_API_KEY || eventIds.length === 0) return {};
  const out: Record<string, EventMeta> = {};
  const chunk = 20;
  try {
    for (let i = 0; i < eventIds.length; i += chunk) {
      const slice = eventIds.slice(i, i + chunk);
      const res = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_API_KEY}&id=${slice.join(',')}&size=${slice.length}`
      );
      if (!res.ok) continue;
      const json = await res.json();
      const events: Array<{ id: string; name: string; dates?: { start?: { localDate?: string } } }> = json._embedded?.events ?? [];
      for (const event of events) {
        out[event.id] = { name: event.name, localDate: event.dates?.start?.localDate };
      }
    }
    return out;
  } catch {
    return out;
  }
}

// ── Inline Modal (from Figma's Modal.tsx) ──────────────────────────────────
function Modal({
  isOpen,
  onClose,
  title,
  children,
  subtitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Explains the list — each modal sets its own so we don’t imply fake “recommendations”. */
  subtitle: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-md z-50"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 14 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="relative bg-card/95 border border-border/80 rounded-3xl shadow-dramatic max-w-3xl w-full max-h-[88vh] overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-accent/10 to-transparent pointer-events-none" />
              <div className="relative flex items-start justify-between px-7 pt-7 pb-5 border-b border-border/70">
                <div>
                  <p className="text-xs tracking-[0.14em] uppercase text-muted-foreground mb-2">Calendar</p>
                  <h2 className="text-2xl font-semibold leading-none font-display">
                    {title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-xl border border-border bg-background/70 hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="px-7 py-6 overflow-y-auto max-h-[calc(88vh-112px)]">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────
interface LikedEvent {
  title: string;
  time: string;
  /** Human date for this occurrence (sidebar / lists) */
  dateLabel: string;
  venue: string;
  attendees: number;
  category: string;
  eventId?: string;
}

interface LikedEventsMap {
  [dateKey: string]: LikedEvent[];
}

function parseLikedEventDate(opts: { rawDisplayDate?: string; startDateIso?: string }): Date | null {
  const iso = opts.startDateIso?.trim();
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const d = new Date(`${iso}T12:00:00`);
    if (!isNaN(d.getTime())) return d;
  }

  const rawDate = opts.rawDisplayDate?.trim();
  if (!rawDate || rawDate === 'TBA') return null;

  const direct = new Date(rawDate);
  if (!isNaN(direct.getTime())) return direct;

  const withCurrentYear = new Date(`${rawDate}, ${new Date().getFullYear()}`);
  if (!isNaN(withCurrentYear.getTime())) return withCurrentYear;

  return null;
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function EventCalendar() {
  useRequireAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [showAllDayEvents, setShowAllDayEvents] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [likedEvents, setLikedEvents] = useState<LikedEventsMap>({});

  const loadLikedEvents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLikedEvents({});
      return;
    }

    const [swipesRes, roomsRes, roomUsersRes] = await Promise.all([
      supabase
        .from('swipes')
        .select('event_id, created_at')
        .eq('user_id', user.id)
        .eq('direction', 'right')
        .order('created_at', { ascending: false }),
      supabase
        .from('rooms')
        .select('id, event_id, event_title, created_at'),
      supabase
        .from('room_users')
        .select('room_id, user_id'),
    ]);

    const swipeRows = swipesRes.error ? [] : (swipesRes.data || []);

    const roomByEventId = new Map<string, { roomId: string; title?: string; createdAt?: string }>();
    for (const room of roomsRes.data || []) {
      if (!room.event_id || roomByEventId.has(room.event_id)) continue;
      roomByEventId.set(room.event_id, { roomId: room.id, title: room.event_title ?? undefined, createdAt: room.created_at ?? undefined });
    }
    const allEventIds = [...new Set(swipeRows.map((s) => s.event_id))];

    const missingMetaIds = allEventIds.filter((eventId) => {
      const roomTitle = roomByEventId.get(eventId)?.title;
      const hasGoodTitle = roomTitle && !roomTitle.startsWith('Event ');
      return !hasGoodTitle;
    });

    const resolvedMeta = await resolveEventMetaById(missingMetaIds);

    const memberSets = new Map<string, Set<string>>();
    for (const ru of roomUsersRes.data || []) {
      if (!memberSets.has(ru.room_id)) memberSets.set(ru.room_id, new Set());
      memberSets.get(ru.room_id)!.add(ru.user_id);
    }

    const map: LikedEventsMap = {};
    const seenEventSwipe = new Set<string>();
    for (const swipe of swipeRows) {
      if (seenEventSwipe.has(swipe.event_id)) continue;
      seenEventSwipe.add(swipe.event_id);
      const roomEvent = roomByEventId.get(swipe.event_id);
      const meta = resolvedMeta[swipe.event_id];
      const fromApiDate = meta?.localDate ? parseLikedEventDate({ startDateIso: meta.localDate }) : null;
      const fallbackDate = new Date(roomEvent?.createdAt || swipe.created_at);
      const date = fromApiDate || fallbackDate;
      if (isNaN(date.getTime())) continue;
      const roomTitle = roomEvent?.title && !roomEvent.title.startsWith('Event ') ? roomEvent.title : undefined;

      const dateKey = format(date, 'yyyy-MM-dd');
      if (!map[dateKey]) map[dateKey] = [];
      const attendees = roomEvent?.roomId ? (memberSets.get(roomEvent.roomId)?.size ?? 0) : 0;
      const resolvedTitle =
        meta?.name ||
        (roomTitle && roomTitle.trim().length > 0 ? roomTitle : null) ||
        'Liked event';
      map[dateKey].push({
        title: resolvedTitle,
        time: format(date, 'h:mm a'),
        dateLabel: format(date, 'EEE, MMM d'),
        venue: 'From your likes',
        attendees,
        category: '',
        eventId: swipe.event_id,
      });
    }

    setLikedEvents(map);
  }, []);

  const handleViewChat = useCallback(async (eventId?: string) => {
    if (!eventId) {
      toast.info('No chat room for this event yet');
      return;
    }
    const { data, error } = await supabase
      .from('rooms')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !data) {
      toast.info('No chat room for this event yet — swipe right to join one!');
      return;
    }
    navigate(`/chat/${data.id}`);
  }, [navigate]);

  useEffect(() => {
    void loadLikedEvents();
  }, [loadLikedEvents, location.pathname]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadLikedEvents();
    };
    const onLikesChanged = () => void loadLikedEvents();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(REKINDLE_LIKED_EVENTS_CHANGED, onLikesChanged);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener(REKINDLE_LIKED_EVENTS_CHANGED, onLikesChanged);
    };
  }, [loadLikedEvents]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return likedEvents[dateKey] || [];
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  /** One row per liked event_id (swipes are unique; this guards stale UI). */
  const allLikedUnique = useMemo(() => {
    const flat = Object.values(likedEvents).flat();
    const byEventId = new Map<string, LikedEvent>();
    for (const ev of flat) {
      const k = ev.eventId || `${ev.title}-${ev.time}`;
      if (!byEventId.has(k)) byEventId.set(k, ev);
    }
    return [...byEventId.values()];
  }, [likedEvents]);

  const suggestedEvents = useMemo(
    () =>
      allLikedUnique.slice(0, 3).map((event) => ({
        title: event.title,
        date: event.dateLabel,
        time: event.time,
        venue: event.venue,
        attendees: event.attendees,
        category: event.category || 'Liked',
        reason: 'From your likes',
        eventId: event.eventId,
      })),
    [allLikedUnique],
  );

  // Derive "This Month" stats from real liked events
  const thisMonthKey = format(currentDate, 'yyyy-MM');
  const thisMonthLikedCount = Object.keys(likedEvents).filter(k => k.startsWith(thisMonthKey)).reduce((acc, k) => acc + likedEvents[k].length, 0);

  // Derive next 7 days with events
  const next7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  }).filter(d => getEventsForDate(d).length > 0).map(d => ({
    day: isToday(d) ? 'Today' : format(d, 'EEEE'),
    count: getEventsForDate(d).length,
    date: format(d, 'EEE, MMM d'),
  }));

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-12 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-5 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <h1 className="text-5xl mb-2 leading-none font-display font-semibold">
              Calendar
            </h1>
            <p className="text-lg text-muted-foreground">
              Your liked events and personalized suggestions
            </p>
          </motion.div>

          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2 space-y-6">
              {/* Calendar Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-semibold text-foreground">
                    <span className="font-display">{format(currentDate, 'MMMM')}</span>{' '}
                    <span className="font-numeric text-2xl tracking-tight">{format(currentDate, 'yyyy')}</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                      className="w-10 h-10 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCurrentDate(new Date())}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
                    >
                      Today
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                      className="w-10 h-10 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                    >
                      <ChevronRight size={20} />
                    </motion.button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center py-2 text-sm font-semibold text-muted-foreground">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day, i) => {
                    const events = getEventsForDate(day);
                    const hasEvents = events.length > 0;
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isTodayDate = isToday(day);

                    return (
                      <motion.button
                        key={i}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          relative aspect-square rounded-xl p-2 transition-all
                          ${!isCurrentMonth ? 'opacity-30' : ''}
                          ${isSelected ? 'bg-accent text-white shadow-lg' : 'hover:bg-muted'}
                          ${isTodayDate && !isSelected ? 'ring-2 ring-accent/30' : ''}
                        `}
                      >
                        <div className="text-sm font-numeric">
                          {format(day, 'd')}
                        </div>
                        {hasEvents && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                            {events.slice(0, 3).map((_, idx) => (
                              <div
                                key={idx}
                                className={`w-1 h-1 rounded-full ${
                                  isSelected ? 'bg-white' : 'bg-accent'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Selected Date Events */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-foreground">
                    <span className="font-display">{format(selectedDate, 'EEEE, MMMM')}</span>{' '}
                    <span className="font-numeric text-xl tracking-tight">{format(selectedDate, 'd')}</span>
                  </h3>
                  {selectedDateEvents.length > 0 && (
                    <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
                      <span className="font-numeric tabular-nums">{selectedDateEvents.length}</span>
                      {' '}
                      {selectedDateEvents.length === 1 ? 'event' : 'events'}
                    </span>
                  )}
                </div>

                {selectedDateEvents.length > 0 ? (
                  <div className="space-y-4">
                    {selectedDateEvents.slice(0, 1).map((event, i) => (
                      <div key={i} className="space-y-4">
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.1 }}
                          className="p-6 rounded-xl border border-border hover:border-accent/20 hover:bg-accent/5 transition-all"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-foreground text-lg">{event.title}</h4>
                                <Heart size={16} className="text-accent fill-accent" />
                              </div>
                              <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                                {event.category || 'Liked'}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Clock size={14} />
                              {event.time}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin size={14} />
                              {event.venue}
                            </div>
                            <div className="flex items-center gap-2 font-body text-sm text-muted-foreground">
                              <Users size={14} className="shrink-0" />
                              {event.attendees === 0 ? (
                                "0 going, no one's in the chat yet"
                              ) : (
                                <>
                                  <span className="font-numeric tabular-nums">
                                    <CountUpValue value={event.attendees} durationMs={650} />
                                  </span>{' '}
                                  going
                                </>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <button
                              onClick={() => handleViewChat(event.eventId)}
                              className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                            >
                              View Group Chat
                            </button>
                            <button
                              onClick={() => navigate('/feed')}
                              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                            >
                              Discover More
                            </button>
                          </div>
                        </motion.div>
                        {selectedDateEvents.length > 1 && (
                          <button
                            onClick={() => setShowAllDayEvents(true)}
                            className="w-full px-4 py-3 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors"
                          >
                            View all {selectedDateEvents.length} events
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Calendar size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-2">No events on this day</p>
                    <p className="text-sm text-muted-foreground">
                      Browse Discover to find events you love
                    </p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <Heart size={16} className="text-accent" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">This Month</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-3xl font-numeric text-foreground leading-none tabular-nums">
                      <CountUpValue value={thisMonthLikedCount} durationMs={900} />
                    </div>
                    <div className="text-xs text-muted-foreground">Events you liked</div>
                  </div>
                  <div className="h-px bg-border" />
                  <div>
                    <div className="text-3xl font-numeric text-foreground leading-none tabular-nums">
                      <CountUpValue
                        value={Object.values(likedEvents).flat().filter(e => e.attendees > 0).length}
                        durationMs={900}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">Events attended</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-accent to-orange-600 rounded-2xl p-6 text-white shadow-[0_8px_32px_rgba(232,71,10,0.2)]"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white/90">From your likes</h3>
                </div>
                <div className="space-y-4">
                  {suggestedEvents.map((event, i) => (
                    <motion.div
                      key={event.eventId || `s-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      <h4 className="font-semibold text-sm mb-1">{event.title}</h4>
                      <p className="text-xs text-white/80 mb-2">{event.reason}</p>
                      <div className="flex items-center justify-between text-xs text-white/90">
                        <span>{event.date}</span>
                        <span className="flex items-center gap-1 font-numeric text-xs tabular-nums">
                          <Users size={12} />
                          <CountUpValue value={event.attendees} durationMs={650} />
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <button
                  onClick={() => setShowAllSuggestions(true)}
                  className="w-full mt-4 py-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors text-sm font-medium"
                >
                  See all liked events
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-card rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4">Next 7 Days</h3>
                <div className="space-y-3">
                  {next7.length > 0 ? next7.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div>
                        <div className="text-sm font-medium text-foreground">{item.day}</div>
                        <div className="text-xs text-muted-foreground">{item.date}</div>
                      </div>
                      <div className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-numeric tabular-nums">
                        <CountUpValue value={item.count} durationMs={700} />
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No events in the next 7 days</p>
                  )}
                </div>
              </motion.div>

            </div>
          </div>

          {/* Liked Events Modal */}
          <Modal
            isOpen={showAllSuggestions}
            onClose={() => setShowAllSuggestions(false)}
            title="Liked Events"
            subtitle="Events you swiped right on in Discover."
          >
            <div className="space-y-2">
              {allLikedUnique.map((event, i) => (
                <motion.div
                  key={event.eventId || `${event.title}-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  {/* Category color bar */}
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${
                    event.category === 'Live Music' ? 'bg-purple-400' :
                    event.category === 'Sports' ? 'bg-blue-400' :
                    event.category === 'Wellness' ? 'bg-emerald-400' :
                    event.category === 'Film' ? 'bg-indigo-400' :
                    event.category === 'Food & Drinks' ? 'bg-orange-400' :
                    'bg-accent'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm leading-snug truncate group-hover:text-accent transition-colors">{event.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.dateLabel}{event.category ? ` · ${event.category}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {event.attendees === 0 ? 'No chat yet' : (
                        <span className="font-numeric tabular-nums">{event.attendees} going</span>
                      )}
                    </p>
                  </div>
                </motion.div>
              ))}
              {allLikedUnique.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No liked events yet — go swipe on Discover!</p>
              )}
            </div>
          </Modal>

          {/* Selected Date Events Modal */}
          <Modal
            isOpen={showAllDayEvents}
            onClose={() => setShowAllDayEvents(false)}
            title={`${format(selectedDate, 'MMMM d')} Events`}
            subtitle="Events you liked that we place on this day (from swipe date or event date when available)."
          >
            <div className="space-y-4">
              {selectedDateEvents.map((event, i) => (
                <motion.div
                  key={event.eventId || `d-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="p-6 rounded-xl border border-border hover:border-accent/20 hover:bg-accent/5 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-foreground text-lg">{event.title}</h4>
                        <Heart size={16} className="text-accent fill-accent" />
                      </div>
                      <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                        {event.category || 'Liked'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock size={14} />
                      {event.time}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} />
                      {event.venue}
                    </div>
                    <div className="flex items-center gap-2 font-body text-sm text-muted-foreground">
                      <Users size={14} className="shrink-0" />
                      {event.attendees === 0 ? (
                        "0 going, no one's in the chat yet"
                      ) : (
                        <>
                          <span className="font-numeric tabular-nums">
                            <CountUpValue value={event.attendees} durationMs={650} />
                          </span>{' '}
                          going
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleViewChat(event.eventId)}
                      className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                    >
                      View Group Chat
                    </button>
                    <button
                      onClick={() => navigate('/feed')}
                      className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Discover More
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </Modal>
        </div>
      </div>
    </AppShell>
  );
}
