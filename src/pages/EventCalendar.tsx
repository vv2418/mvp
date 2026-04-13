import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Users, Heart, Sparkles, Clock, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import AppShell from '@/components/AppShell';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { ReactNode } from 'react';

// ── Inline Modal (from Figma's Modal.tsx) ──────────────────────────────────
function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
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
  venue: string;
  attendees: number;
  category: string;
}

interface LikedEventsMap {
  [dateKey: string]: LikedEvent[];
}

function loadLikedEvents(): LikedEventsMap {
  try {
    const raw = localStorage.getItem('rekindle_liked_events');
    if (!raw) return getDefaultLikedEvents();
    const parsed = JSON.parse(raw);
    // parsed is an array of { id, title, date, location, image }
    // convert to the map format the Figma calendar expects
    const map: LikedEventsMap = {};
    for (const ev of parsed) {
      if (!ev.date || ev.date === 'TBA') continue;
      const d = new Date(`${ev.date}, ${new Date().getFullYear()}`);
      if (isNaN(d.getTime())) continue;
      const key = format(d, 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push({
        title: ev.title ?? 'Event',
        time: ev.time ?? '7:00 PM',
        venue: ev.location ?? 'Venue TBA',
        attendees: ev.attendees ?? 12,
        category: ev.category ?? 'Event',
      });
    }
    if (Object.keys(map).length === 0) return getDefaultLikedEvents();
    return map;
  } catch {
    return getDefaultLikedEvents();
  }
}

function getDefaultLikedEvents(): LikedEventsMap {
  return {
    '2026-04-19': [
      { title: 'Jazz Under the Stars', time: '8:00 PM', venue: 'Blue Note', attendees: 12, category: 'Live Music' },
    ],
    '2026-04-20': [
      { title: 'Sunset Rooftop Yoga', time: '6:30 PM', venue: 'The Skyline', attendees: 8, category: 'Wellness' },
      { title: 'Sunday Brunch Club', time: '11:00 AM', venue: 'The Garden', attendees: 15, category: 'Food & Drinks' },
    ],
    '2026-04-25': [
      { title: 'Film & Wine Night', time: '7:00 PM', venue: 'Criterion Cinema', attendees: 15, category: 'Film' },
    ],
    '2026-04-13': [
      { title: 'Art Gallery Opening', time: '6:00 PM', venue: 'Modern Space', attendees: 24, category: 'Art & Culture' },
    ],
  };
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function EventCalendar() {
  useRequireAuth();

  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const likedEvents = loadLikedEvents();

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

  const suggestedEvents = [
    {
      title: 'Indie Band Showcase',
      date: 'Fri, Apr 18',
      time: '9:00 PM',
      venue: 'The Underground',
      attendees: 32,
      category: 'Live Music',
      reason: 'Similar to Jazz Under the Stars',
    },
    {
      title: 'Morning Meditation Session',
      date: 'Sun, Apr 27',
      time: '7:00 AM',
      venue: 'Central Park',
      attendees: 18,
      category: 'Wellness',
      reason: 'You liked Rooftop Yoga',
    },
    {
      title: 'Documentary Screening',
      date: 'Sat, Apr 26',
      time: '8:00 PM',
      venue: 'Alamo Drafthouse',
      attendees: 22,
      category: 'Film',
      reason: 'Similar to Film & Wine Night',
    },
  ];

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
            <h1 className="text-5xl mb-2" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
              Calendar
            </h1>
            <p className="text-lg text-muted-foreground">
              Your liked events and personalized suggestions
            </p>
          </motion.div>

          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2">
              {/* Calendar Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)] mb-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                    {format(currentDate, 'MMMM yyyy')}
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
                        <div className="text-sm font-medium">
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
                className="bg-white rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                    {format(selectedDate, 'EEEE, MMMM d')}
                  </h3>
                  {selectedDateEvents.length > 0 && (
                    <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
                      {selectedDateEvents.length} {selectedDateEvents.length === 1 ? 'event' : 'events'}
                    </span>
                  )}
                </div>

                {selectedDateEvents.length > 0 ? (
                  <div className="space-y-4">
                    {selectedDateEvents.map((event, i) => (
                      <motion.div
                        key={i}
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
                              {event.category}
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
                          <div className="flex items-center gap-2">
                            <Users size={14} />
                            {event.attendees} going
                          </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <button className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors">
                            View Group Chat
                          </button>
                          <button className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                            Details
                          </button>
                        </div>
                      </motion.div>
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
                className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <Heart size={16} className="text-accent" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">This Month</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-3xl font-semibold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
                      {thisMonthLikedCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Events you liked</div>
                  </div>
                  <div className="h-px bg-border" />
                  <div>
                    <div className="text-3xl font-semibold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
                      2
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
                  <h3 className="text-sm font-semibold text-white/90">Suggested For You</h3>
                </div>
                <div className="space-y-4">
                  {suggestedEvents.map((event, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      <h4 className="font-semibold text-sm mb-1">{event.title}</h4>
                      <p className="text-xs text-white/80 mb-2">{event.reason}</p>
                      <div className="flex items-center justify-between text-xs text-white/90">
                        <span>{event.date}</span>
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {event.attendees}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <button
                  onClick={() => setShowAllSuggestions(true)}
                  className="w-full mt-4 py-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors text-sm font-medium"
                >
                  See All Suggestions
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4">Next 7 Days</h3>
                <div className="space-y-3">
                  {next7.length > 0 ? next7.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div>
                        <div className="text-sm font-medium text-foreground">{item.day}</div>
                        <div className="text-xs text-muted-foreground">{item.date}</div>
                      </div>
                      <div className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
                        {item.count}
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No events in the next 7 days</p>
                  )}
                </div>
              </motion.div>
            </div>
          </div>

          {/* All Suggestions Modal */}
          <Modal isOpen={showAllSuggestions} onClose={() => setShowAllSuggestions(false)} title="Suggested Events">
            <div className="space-y-4">
              {[...suggestedEvents, ...suggestedEvents].map((event, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-border hover:border-accent/20 hover:bg-accent/5 transition-all cursor-pointer"
                >
                  <h4 className="font-semibold text-foreground mb-1">{event.title}</h4>
                  <p className="text-xs text-accent mb-3">{event.reason}</p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      {event.date} • {event.time}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users size={14} />
                      {event.attendees}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                    <MapPin size={12} />
                    {event.venue}
                  </div>
                  <button className="w-full py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
                    View Event
                  </button>
                </div>
              ))}
            </div>
          </Modal>
        </div>
      </div>
    </AppShell>
  );
}
