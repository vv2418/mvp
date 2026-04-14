import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Heart, MessageCircle, Users, Edit2, Camera, X, Loader2, LogOut, AlertTriangle, ArrowLeft, ChevronRight, Sparkles, TrendingUp } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import AppShell from '@/components/AppShell';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { REKINDLE_PROFILE_UPDATED } from '@/lib/rekindle-events';
import { CountUpValue } from '@/components/CountUpValue';

const INTEREST_LABELS: Record<string, string> = {
  music: 'Live Music', sports: 'Sports', tech: 'Tech', food: 'Food & Drinks',
  art: 'Art & Culture', fitness: 'Wellness', gaming: 'Gaming', movies: 'Film',
  travel: 'Travel', reading: 'Reading', photography: 'Photography',
  networking: 'Networking', dance: 'Dance', outdoors: 'Outdoor Activities',
  comedy: 'Comedy', volunteering: 'Volunteering', startups: 'Startups', cooking: 'Cooking',
};

export default function Profile() {
  useRequireAuth();
  const navigate = useNavigate();

  // ── Real data state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatar, setAvatar] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [userStats, setUserStats] = useState([
    { label: 'Events Attended', value: '0', icon: Calendar },
    { label: 'Events Liked', value: '0', icon: Heart },
    { label: 'Connections Made', value: '0', icon: Users },
    { label: 'Active Chats', value: '0', icon: MessageCircle },
  ]);
  const [upcomingEvents, setUpcomingEvents] = useState<{ title: string; date: string; venue: string; attendees: number; roomId: string }[]>([]);
  const [recentConnections, setRecentConnections] = useState<{ name: string; event: string; initial: string; roomId: string }[]>([]);

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
        supabase.from('profiles').select('name, avatar_url, bio, location, created_at').eq('id', user.id).maybeSingle(),
        supabase.from('user_interests').select('interest_id').eq('user_id', user.id),
        supabase.from('room_users').select('room_id').eq('user_id', user.id),
        supabase.from('swipes').select('event_id, created_at').eq('user_id', user.id).eq('direction', 'right'),
      ]);

      const profileRow = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
      const userInterests = interestsRes.status === 'fulfilled' ? (interestsRes.value.data || []) : [];
      const rooms = roomsRes.status === 'fulfilled' ? (roomsRes.value.data || []) : [];
      const swipes = swipesRes.status === 'fulfilled' ? (swipesRes.value.data || []) : [];

      let finalProfile = profileRow;
      const legacyBio = typeof localStorage !== 'undefined' ? localStorage.getItem('rekindle_bio') : null;
      const legacyLoc = typeof localStorage !== 'undefined' ? localStorage.getItem('rekindle_location') : null;
      if (profileRow && ((!profileRow.bio && legacyBio) || (!profileRow.location && legacyLoc))) {
        await supabase
          .from('profiles')
          .update({
            ...(!profileRow.bio && legacyBio ? { bio: legacyBio } : {}),
            ...(!profileRow.location && legacyLoc ? { location: legacyLoc } : {}),
          })
          .eq('id', user.id);
        if (!profileRow.bio && legacyBio) localStorage.removeItem('rekindle_bio');
        if (!profileRow.location && legacyLoc) localStorage.removeItem('rekindle_location');
        const { data: after } = await supabase
          .from('profiles')
          .select('name, avatar_url, bio, location, created_at')
          .eq('id', user.id)
          .maybeSingle();
        if (after) finalProfile = after;
      }

      const realName = finalProfile?.name || user.user_metadata?.name || 'You';
      const realAvatar = finalProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${realName}`;
      const realBio = finalProfile?.bio ?? '';
      const realLocation = finalProfile?.location ?? '';
      const realInterests = userInterests.map((i: { interest_id: string }) => i.interest_id);

      setName(realName);
      setAvatar(realAvatar);
      setBio(realBio);
      setLocation(realLocation);
      setInterests(realInterests);
      setEditName(realName);
      setEditBio(realBio);
      setEditLocation(realLocation);
      const MIN_CHAT_MEMBERS = 2;
      const membershipIds = [...new Set((rooms as { room_id: string }[]).map((r) => r.room_id))];
      const { data: roomData } = membershipIds.length > 0
        ? await supabase.from('rooms').select('id, event_id, event_title, created_at').in('id', membershipIds).order('created_at', { ascending: false })
        : { data: [] as { id: string; event_id: string; event_title: string | null; created_at: string }[] };
      const roomRowsRaw = roomData || [];
      const byEvent = new Map<string, (typeof roomRowsRaw)[number]>();
      for (const r of roomRowsRaw) {
        const key = r.event_id || r.id;
        const cur = byEvent.get(key);
        if (!cur || r.created_at < cur.created_at) byEvent.set(key, r);
      }
      const roomRows = [...byEvent.values()].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const roomIds = roomRows.map((r) => r.id);

      const memberSets = new Map<string, Set<string>>();
      if (roomIds.length > 0) {
        const { data: roomMembers } = await supabase.from('room_users').select('room_id, user_id').in('room_id', roomIds);
        for (const m of roomMembers || []) {
          if (!memberSets.has(m.room_id)) memberSets.set(m.room_id, new Set());
          memberSets.get(m.room_id)!.add(m.user_id);
        }
      }

      const activeRoomRows = roomRows.filter((r) => (memberSets.get(r.id)?.size ?? 0) >= MIN_CHAT_MEMBERS);
      const uniqueConnections = new Set<string>();
      for (const m of memberSets.entries()) {
        const [rid, ids] = m;
        if ((ids.size ?? 0) < MIN_CHAT_MEMBERS) continue;
        for (const uid of ids) {
          if (uid !== user.id) uniqueConnections.add(uid);
        }
      }

      setUserStats([
        { label: 'Events Attended', value: String(activeRoomRows.length), icon: Calendar },
        { label: 'Events Liked', value: String(swipes.length), icon: Heart },
        { label: 'Connections Made', value: String(uniqueConnections.size), icon: Users },
        { label: 'Active Chats', value: String(activeRoomRows.length), icon: MessageCircle },
      ]);

      setUpcomingEvents(
        activeRoomRows.map((r) => ({
          title: r.event_title || 'Event',
          date: new Date(r.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          venue: 'Group Chat',
          attendees: memberSets.get(r.id)?.size ?? 0,
          roomId: r.id,
        })).slice(0, 3),
      );

      const connections: { name: string; event: string; initial: string; roomId: string }[] = [];
      for (const room of activeRoomRows.slice(0, 4)) {
        const { data: others } = await supabase
          .from('room_users')
          .select('user_id')
          .eq('room_id', room.id)
          .neq('user_id', user.id)
          .limit(1);
        if (others?.[0]) {
          const { data: p } = await supabase.from('profiles').select('name').eq('id', others[0].user_id).maybeSingle();
          if (p?.name)
            connections.push({
              name: p.name,
              event: room.event_title || 'an event',
              initial: p.name[0].toUpperCase(),
              roomId: room.id,
            });
        }
      }
      setRecentConnections(connections);

      setLoading(false);
    })();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({
          name: editName.trim(),
          bio: editBio.trim() || null,
          location: editLocation.trim() || null,
        })
        .eq('id', user.id);
      setName(editName.trim());
      setBio(editBio.trim());
      setLocation(editLocation.trim());
      toast.success('Profile updated');
      window.dispatchEvent(new CustomEvent(REKINDLE_PROFILE_UPDATED));
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
    if (error) {
      // Fallback: encode as base64 and store in profile metadata
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await supabase.from('profiles').update({ avatar_url: dataUrl }).eq('id', user.id);
        setAvatar(dataUrl);
        toast.success('Photo updated');
        window.dispatchEvent(new CustomEvent(REKINDLE_PROFILE_UPDATED));
        setUploadingAvatar(false);
      };
      reader.onerror = () => { toast.error('Could not process image'); setUploadingAvatar(false); };
      reader.readAsDataURL(file);
      e.target.value = '';
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar.${ext}`);
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    setAvatar(publicUrl);
    toast.success('Photo updated');
    window.dispatchEvent(new CustomEvent(REKINDLE_PROFILE_UPDATED));
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 flex items-start gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="mt-2 sm:mt-3 shrink-0 flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-border hover:bg-muted hover:text-foreground active:scale-[0.97]"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-5xl mb-2" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>Profile</h1>
              <p className="text-lg text-muted-foreground">Manage your profile and view your activity</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2 space-y-6">

              {/* Profile Header Card */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-card rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="flex items-start gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent to-orange-600 flex items-center justify-center text-white text-3xl font-semibold overflow-hidden">
                      {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
                    </div>
                    <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
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
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
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
                className="grid grid-cols-2 gap-3">
                {userStats.map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 + i * 0.05, ease: [0.22, 1, 0.36, 1] as const }}
                    className="flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                  >
                    <stat.icon size={16} className="text-muted-foreground mb-6" />
                    <div>
                      <div className="text-[2.75rem] font-black leading-none tracking-tight text-foreground tabular-nums">
                        <CountUpValue value={parseInt(stat.value, 10) || 0} durationMs={900} />
                      </div>
                      <div className="mt-1.5 text-sm font-medium text-muted-foreground">{stat.label}</div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Upcoming Events */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-card rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
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
                          <div className="flex items-center gap-1 text-sm text-muted-foreground font-numeric">
                            <Users size={14} />
                            <CountUpValue value={event.attendees} durationMs={700} />
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

            </div>

            {/* Sidebar — light shells; inner patterns mirror Discover (p-5, muted panel, coral gradient, trending-style rows) */}
            <div className="space-y-4">
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className="bg-card rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-accent shrink-0" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interests</span>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border/50 p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {interests.map((interest, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-card border border-border text-foreground"
                      >
                        {INTEREST_LABELS[interest] ?? interest}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-numeric tabular-nums">
                    <CountUpValue value={interests.length} durationMs={700} /> on your profile
                  </span>
                  <button type="button" onClick={() => navigate('/interests')} className="text-xs font-semibold text-accent hover:text-accent/80 transition-colors">
                    Edit →
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-gradient-to-br from-accent to-orange-600 rounded-2xl p-5 text-white shadow-[0_8px_32px_rgba(232,71,10,0.2)] flex flex-col justify-between"
              >
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-white/80" />
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">This week</span>
                </div>
                <div className="flex flex-col gap-3">
                  {(() => {
                    const liked = parseInt(userStats[1].value, 10) || 0;
                    const chats = parseInt(userStats[3].value, 10) || 0;
                    const conn = parseInt(userStats[2].value, 10) || 0;
                    const max = Math.max(liked, chats, conn, 1);
                    const rows = [
                      { label: 'Events liked', value: liked, w: `${Math.min(100, Math.round((liked / max) * 100))}%` },
                      { label: 'Group chats', value: chats, w: `${Math.min(100, Math.round((chats / max) * 100))}%` },
                      { label: 'Connections', value: conn, w: `${Math.min(100, Math.round((conn / max) * 100))}%` },
                    ];
                    return rows.map((row, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-white">{row.label}</span>
                          <span className="font-numeric text-xs bg-white/20 px-2 py-0.5 rounded-full inline-flex tabular-nums">
                            <CountUpValue value={row.value} durationMs={750} />
                          </span>
                        </div>
                        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white/60 rounded-full transition-all" style={{ width: row.w }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                className="bg-card rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-accent shrink-0" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">People</span>
                  </div>
                  {recentConnections.length > 0 && (
                    <button type="button" onClick={() => navigate('/rooms')} className="text-xs font-semibold text-accent hover:text-accent/80 transition-colors">
                      Chats →
                    </button>
                  )}
                </div>
                {recentConnections.length > 0 ? (
                  <div className="space-y-2">
                    {recentConnections.map((c, i) => (
                      <motion.button
                        key={i}
                        type="button"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * i }}
                        onClick={() => navigate(`/chat/${c.roomId}`)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-background/40 p-4 text-left transition-all hover:border-border hover:shadow-sm group"
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-orange-600 text-base font-bold text-primary-foreground">
                          {c.initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-accent transition-colors">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.event}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center gap-2 rounded-2xl border border-border/50 bg-muted/30 py-8 px-4">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <MessageCircle className="h-6 w-6 text-accent" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">No one here yet</p>
                    <p className="text-xs text-muted-foreground max-w-[220px]">Match on an event and open the group chat — names land here automatically.</p>
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}
                className="bg-card rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-accent shrink-0" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account</span>
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => navigate('/settings')}
                    className="group flex w-full items-center justify-between rounded-2xl border border-border/50 p-4 text-left transition-all hover:border-border hover:shadow-sm"
                  >
                    <span className="text-sm font-semibold text-foreground">Settings</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
                    className="group flex w-full items-center justify-between rounded-2xl border border-border/50 p-4 text-left transition-all hover:border-destructive/30 hover:bg-destructive/5"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-destructive">
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Location</label>
            <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="City or neighborhood (optional)"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Bio</label>
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={4} placeholder="Tell people a bit about you"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none" />
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
                className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-8">
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
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20" />
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
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/20" />
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
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/20" />
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
              className="bg-card rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
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
