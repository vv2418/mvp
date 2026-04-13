import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Heart, MessageCircle, Users, Edit2, Camera, X, Loader2, LogOut, Trash2, RefreshCw, Mail, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import AppShell from '@/components/AppShell';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const INTEREST_LABELS: Record<string, string> = {
  music: 'Live Music', sports: 'Sports', tech: 'Tech', food: 'Food & Drinks',
  art: 'Art & Culture', fitness: 'Wellness', gaming: 'Gaming', movies: 'Film',
  travel: 'Travel', reading: 'Reading', photography: 'Photography',
  networking: 'Networking', dance: 'Dance', outdoors: 'Outdoor Activities',
  comedy: 'Comedy', volunteering: 'Volunteering', startups: 'Startups', cooking: 'Cooking',
};

interface LikedEvent { id: string; title: string; date: string; location: string; image: string; }

export default function Profile() {
  useRequireAuth();
  const navigate = useNavigate();

  // ── Real data state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('Alex Rivera');
  const [bio, setBio] = useState("Music lover, coffee enthusiast, and always up for exploring new places. Looking to meet like-minded people who enjoy live music and creative experiences.");
  const [location, setLocation] = useState('Brooklyn, NY');
  const [avatar, setAvatar] = useState('');
  const [interests, setInterests] = useState(['music', 'art', 'food', 'fitness', 'outdoors', 'networking', 'movies', 'gaming']);
  const [userStats, setUserStats] = useState([
    { label: 'Events Attended', value: '0', icon: Calendar },
    { label: 'Events Liked', value: '0', icon: Heart },
    { label: 'Connections Made', value: '0', icon: Users },
    { label: 'Active Chats', value: '0', icon: MessageCircle },
  ]);
  const [upcomingEvents, setUpcomingEvents] = useState<{ title: string; date: string; venue: string; attendees: number; roomId: string }[]>([]);
  const [pastEvents, setPastEvents] = useState<LikedEvent[]>([]);
  const [recentConnections, setRecentConnections] = useState<{ name: string; event: string; initial: string }[]>([]);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ── Edit profile modal ───────────────────────────────────────────────────────
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Danger zone ──────────────────────────────────────────────────────────────
  type DangerModal = 'change-email' | 'reset-data' | 'delete-account' | null;
  const [dangerModal, setDangerModal] = useState<DangerModal>(null);
  const [dangerInput, setDangerInput] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

  // ── Load real data ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [profileRes, interestsRes, roomsRes, swipesRes] = await Promise.allSettled([
        (supabase.from('profiles') as any).select('name, avatar_url, created_at').eq('id', user.id).maybeSingle(),
        supabase.from('user_interests').select('interest_id').eq('user_id', user.id),
        supabase.from('room_users').select('room_id').eq('user_id', user.id),
        supabase.from('swipes').select('id').eq('user_id', user.id).eq('direction', 'right'),
      ]);

      const profileRow = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
      const userInterests = interestsRes.status === 'fulfilled' ? (interestsRes.value.data || []) : [];
      const rooms = roomsRes.status === 'fulfilled' ? (roomsRes.value.data || []) : [];
      const swipes = swipesRes.status === 'fulfilled' ? (swipesRes.value.data || []) : [];

      const realName = profileRow?.name || user.user_metadata?.name || 'You';
      const realAvatar = profileRow?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${realName}`;
      const realBio = localStorage.getItem('rekindle_bio') || bio;
      const realLocation = localStorage.getItem('rekindle_location') || location;
      const realInterests = userInterests.length > 0 ? userInterests.map((i: any) => i.interest_id) : interests;
      const liked = (() => { try { return JSON.parse(localStorage.getItem('rekindle_liked_events') || '[]'); } catch { return []; } })();

      setName(realName);
      setAvatar(realAvatar);
      setBio(realBio);
      setLocation(realLocation);
      setInterests(realInterests);
      setEditName(realName);
      setEditBio(realBio);
      setEditLocation(realLocation);
      setPastEvents(liked);

      setUserStats([
        { label: 'Events Attended', value: String(liked.length), icon: Calendar },
        { label: 'Events Liked', value: String(swipes.length), icon: Heart },
        { label: 'Connections Made', value: String(rooms.length * 3), icon: Users },
        { label: 'Active Chats', value: String(rooms.length), icon: MessageCircle },
      ]);

      // Upcoming events from rooms
      if (rooms.length > 0) {
        const roomIds = rooms.map((r: any) => r.room_id);
        const { data: roomData } = await supabase.from('rooms').select('id, event_title, created_at').in('id', roomIds).order('created_at', { ascending: false }).limit(3);
        setUpcomingEvents((roomData || []).map((r: any) => ({
          title: r.event_title || 'Event',
          date: new Date(r.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          venue: 'Group Chat',
          attendees: Math.floor(Math.random() * 15) + 5,
          roomId: r.id,
        })));

        // Recent connections
        const connections: { name: string; event: string; initial: string }[] = [];
        for (const room of (roomData || []).slice(0, 4)) {
          const { data: others } = await supabase.from('room_users').select('user_id').eq('room_id', room.id).neq('user_id', user.id).limit(1);
          if (others?.[0]) {
            const { data: p } = await supabase.from('profiles').select('name').eq('id', others[0].user_id).maybeSingle();
            if (p?.name) connections.push({ name: p.name, event: room.event_title || 'an event', initial: p.name[0].toUpperCase() });
          }
        }
        setRecentConnections(connections);
      }

      setLoading(false);
    })();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ name: editName.trim() }).eq('id', user.id);
      localStorage.setItem('rekindle_bio', editBio);
      localStorage.setItem('rekindle_location', editLocation);
      setName(editName.trim()); setBio(editBio); setLocation(editLocation);
      toast.success('Profile updated');
    }
    setSaving(false);
    setEditProfileOpen(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setUploadingAvatar(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadingAvatar(false); return; }
    const ext = file.name.split('.').pop() ?? 'jpg';
    const { error } = await supabase.storage.from('avatars').upload(`${user.id}/avatar.${ext}`, file, { upsert: true });
    if (error) { toast.error('Upload failed'); setUploadingAvatar(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar.${ext}`);
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    setAvatar(publicUrl);
    toast.success('Photo updated');
    setUploadingAvatar(false);
    e.target.value = '';
  };

  const handleChangeEmail = async () => {
    if (!dangerInput.includes('@')) { toast.error('Enter a valid email'); return; }
    setDangerLoading(true);
    const { error } = await supabase.auth.updateUser({ email: dangerInput.trim() });
    setDangerLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Confirmation sent — check your inbox');
    setDangerModal(null); setDangerInput('');
  };

  const handleResetData = async () => {
    if (dangerInput !== 'RESET') { toast.error("Type RESET to confirm"); return; }
    setDangerLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await Promise.allSettled([
        supabase.from('swipes').delete().eq('user_id', user.id),
        supabase.from('user_interests').delete().eq('user_id', user.id),
        supabase.from('room_users').delete().eq('user_id', user.id),
      ]);
      ['rekindle_favourites','rekindle_liked_events','rekindle_interests','rekindle_last_location','rekindle_bio','rekindle_location'].forEach(k => localStorage.removeItem(k));
    }
    setDangerLoading(false); setDangerModal(null); setDangerInput('');
    toast.success('All data reset');
    navigate('/interests');
  };

  const handleDeleteAccount = async () => {
    if (dangerInput !== 'DELETE') { toast.error("Type DELETE to confirm"); return; }
    setDangerLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await Promise.allSettled([
        supabase.from('swipes').delete().eq('user_id', user.id),
        supabase.from('user_interests').delete().eq('user_id', user.id),
        supabase.from('room_users').delete().eq('user_id', user.id),
        supabase.from('profiles').delete().eq('id', user.id),
      ]);
      await supabase.auth.signOut();
    }
    toast.success('Account deleted');
    navigate('/');
  };

  if (loading) return (
    <AppShell>
      <div className="flex flex-1 items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  );

  // ── JSX — verbatim from Figma's ProfilePage.tsx ──────────────────────────────
  return (
    <AppShell>
      <div className="flex flex-1 flex-col bg-background min-h-0 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-12 py-8 w-full pb-24 lg:pb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
            <h1 className="text-5xl mb-2" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>Profile</h1>
            <p className="text-lg text-muted-foreground">Manage your profile and view your activity</p>
          </motion.div>

          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2 space-y-6">

              {/* Profile Header Card */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="flex items-start gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent to-orange-600 flex items-center justify-center text-white text-3xl font-semibold overflow-hidden">
                      {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
                    </div>
                    <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
                      {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{name}</h2>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <MapPin size={14} />{location}
                        </div>
                      </div>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setEditProfileOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors">
                        <Edit2 size={14} />Edit Profile
                      </motion.button>
                    </div>

                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      {bio || <span className="italic opacity-50">No bio yet — click Edit Profile to add one</span>}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {interests.slice(0, 5).map((interest, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium">
                          {INTEREST_LABELS[interest] ?? interest}
                        </span>
                      ))}
                      {interests.length > 5 && (
                        <span className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium">
                          +{interests.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Stats Grid */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="grid grid-cols-4 gap-4">
                {userStats.map((stat, i) => (
                  <div key={i} className="bg-white rounded-xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                      <stat.icon size={18} className="text-accent" />
                    </div>
                    <div className="text-3xl font-semibold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </motion.div>

              {/* Upcoming Events */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <h3 className="text-xl font-semibold mb-6" style={{ fontFamily: 'var(--font-heading)' }}>Upcoming Events</h3>
                {upcomingEvents.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingEvents.map((event, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-accent/20 hover:bg-accent/5 transition-all">
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">{event.title}</h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar size={14} />{event.date}</span>
                            <span className="flex items-center gap-1"><MapPin size={14} />{event.venue}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users size={14} />{event.attendees}
                          </div>
                          <button onClick={() => navigate(`/chat/${event.roomId}`)}
                            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors">
                            View Chat
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No upcoming events yet — swipe on events to get matched!</p>
                )}
              </motion.div>

              {/* Past Events */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="bg-white rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <h3 className="text-xl font-semibold mb-6" style={{ fontFamily: 'var(--font-heading)' }}>Past Events</h3>
                {pastEvents.length > 0 ? (
                  <div className="space-y-3">
                    {pastEvents.map((event, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={event.image} alt={event.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          <div className="min-w-0">
                            <h4 className="font-medium text-foreground truncate">{event.title}</h4>
                            <div className="text-sm text-muted-foreground">{event.date}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm shrink-0 ml-4">
                          <span className="text-muted-foreground">3 connections</span>
                          <div className="flex gap-0.5">
                            {[...Array(4)].map((_, j) => <Heart key={j} size={14} className="text-accent fill-accent" />)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Like events on Discover to see them here</p>
                )}
              </motion.div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <h3 className="text-sm font-semibold text-foreground mb-4">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {interests.map((interest, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                      {INTEREST_LABELS[interest] ?? interest}
                    </span>
                  ))}
                </div>
                <button onClick={() => navigate('/interests')} className="w-full mt-4 py-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors">
                  Edit Interests
                </button>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <h3 className="text-sm font-semibold text-foreground mb-4">Recent Connections</h3>
                {recentConnections.length > 0 ? (
                  <div className="space-y-3">
                    {recentConnections.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-orange-600 flex items-center justify-center text-white font-medium text-sm">
                          {c.initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">Met at {c.event}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No connections yet</p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <h3 className="text-sm font-semibold text-foreground mb-4">Achievements</h3>
                <div className="space-y-4">
                  {[
                    { emoji: '🔥', title: 'On a Streak!', detail: `${userStats[0].value} events this month`, active: parseInt(userStats[1].value) >= 3 },
                    { emoji: '⭐', title: 'Social Butterfly', detail: `${userStats[2].value}+ connections made`, active: parseInt(userStats[3].value) >= 1 },
                    { emoji: '🎵', title: 'Music Lover', detail: 'Attend 3 more music events', active: false },
                  ].map((a, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${a.active ? 'bg-accent/10' : 'bg-muted opacity-50'}`}>
                        {a.emoji}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${a.active ? 'text-foreground' : 'text-muted-foreground'}`}>{a.title}</div>
                        <div className="text-xs text-muted-foreground">{a.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Danger zone quick actions */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <h3 className="text-sm font-semibold text-foreground mb-4">Account</h3>
                <div className="space-y-3">
                  <button onClick={() => navigate('/settings')} className="w-full text-left text-sm text-muted-foreground hover:text-accent transition-colors">Settings</button>
                  <button onClick={() => { setDangerModal('change-email'); setDangerInput(''); }} className="w-full text-left text-sm text-muted-foreground hover:text-accent transition-colors">Change Email</button>
                  <button onClick={() => { setDangerModal('reset-data'); setDangerInput(''); }} className="w-full text-left text-sm text-muted-foreground hover:text-destructive transition-colors">Reset Data</button>
                  <button onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
                    className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal isOpen={editProfileOpen} onClose={() => setEditProfileOpen(false)} title="Edit Profile">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Name</label>
            <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Location</label>
            <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Bio</label>
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={4}
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Interests</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {interests.slice(0, 5).map((interest, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium cursor-pointer hover:bg-accent/20 transition-colors">
                  {INTEREST_LABELS[interest] ?? interest} ×
                </span>
              ))}
            </div>
            <button onClick={() => { setEditProfileOpen(false); navigate('/interests'); }} className="text-sm text-accent hover:text-accent/80 font-medium">
              + Edit Interests
            </button>
          </div>
          <button onClick={handleSaveProfile} disabled={saving}
            className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* Danger Zone Modals */}
      <AnimatePresence>
        {dangerModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setDangerModal(null); setDangerInput(''); }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle size={20} className="text-destructive" />
                  </div>
                  <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                    {dangerModal === 'change-email' ? 'Change Email' : dangerModal === 'reset-data' ? 'Reset All Data' : 'Delete Account'}
                  </h2>
                </div>
                {dangerModal === 'change-email' && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Enter your new email. Confirmation sent to both addresses.</p>
                    <input type="email" value={dangerInput} onChange={e => setDangerInput(e.target.value)} placeholder="new@email.com"
                      className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent/20" />
                    <button onClick={handleChangeEmail} disabled={dangerLoading}
                      className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50">
                      {dangerLoading ? 'Sending…' : 'Send Confirmation'}
                    </button>
                  </div>
                )}
                {dangerModal === 'reset-data' && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Deletes all swipes, interests, and rooms. Type <strong>RESET</strong> to confirm.</p>
                    <input value={dangerInput} onChange={e => setDangerInput(e.target.value)} placeholder="Type RESET"
                      className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-destructive/20" />
                    <button onClick={handleResetData} disabled={dangerLoading}
                      className="w-full py-3 bg-destructive text-white rounded-xl font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50">
                      {dangerLoading ? 'Resetting…' : 'Reset Everything'}
                    </button>
                  </div>
                )}
                {dangerModal === 'delete-account' && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Permanently deletes your account. Type <strong>DELETE</strong> to confirm.</p>
                    <input value={dangerInput} onChange={e => setDangerInput(e.target.value)} placeholder="Type DELETE"
                      className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-destructive/20" />
                    <button onClick={handleDeleteAccount} disabled={dangerLoading}
                      className="w-full py-3 bg-destructive text-white rounded-xl font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50">
                      {dangerLoading ? 'Deleting…' : 'Delete Forever'}
                    </button>
                  </div>
                )}
                <button onClick={() => { setDangerModal(null); setDangerInput(''); }}
                  className="w-full mt-3 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
