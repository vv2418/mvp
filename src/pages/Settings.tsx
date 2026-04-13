import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Lock, Globe, CreditCard, Shield, Mail, MapPin, X, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTheme } from '@/components/ThemeProvider';
import { toast } from 'sonner';

export default function Settings() {
  useRequireAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { supported: pushSupported, permission, subscribed, subscribe, unsubscribe } = usePushNotifications();

  // ── Figma state (unchanged) ──────────────────────────────────────────────────
  const [pushOptimistic, setPushOptimistic] = useState<boolean | null>(null);
  const pushOn = pushOptimistic ?? subscribed;
  const [matchAlerts, setMatchAlerts] = useState(true);
  const [eventReminders, setEventReminders] = useState(true);
  const [chatMessages, setChatMessages] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [showLocation, setShowLocation] = useState(true);

  // ── Modal state (from Figma) ─────────────────────────────────────────────────
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [location, setLocation] = useState('Brooklyn, NY');
  const [language, setLanguage] = useState('en-US');
  const [saving, setSaving] = useState(false);

  // ── Real handlers (swapped in for Figma's alert() calls) ────────────────────
  const handlePushToggle = async () => {
    if (pushOn) {
      setPushOptimistic(false); await unsubscribe(); setPushOptimistic(null);
      toast.success('Push notifications off');
    } else {
      setPushOptimistic(true); const ok = await subscribe(); setPushOptimistic(null);
      toast[ok ? 'success' : 'error'](ok ? 'Push notifications on' : 'Permission denied');
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.includes('@')) { toast.error('Enter a valid email'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Confirmation sent to both addresses — check your inbox');
    setEmailModalOpen(false); setNewEmail('');
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Password updated');
    setPasswordModalOpen(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
  };

  // ── Figma's settingsSections (push toggle replaced with real hook) ────────────
  const settingsSections = [
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        {
          label: 'Push Notifications',
          description: !pushSupported ? 'Not supported in this browser' : permission === 'denied' ? 'Blocked in browser settings' : 'Get notified about new matches and messages',
          value: pushSupported ? pushOn : false,
          onChange: handlePushToggle,
          isRealToggle: true,
          disabled: !pushSupported || permission === 'denied',
        },
        { label: 'Match Alerts', description: 'Notify when you match with someone on an event', value: matchAlerts, onChange: () => setMatchAlerts(v => !v) },
        { label: 'Event Reminders', description: 'Remind me 24 hours before an event', value: eventReminders, onChange: () => setEventReminders(v => !v) },
        { label: 'Chat Messages', description: 'Notify when you receive new chat messages', value: chatMessages, onChange: () => setChatMessages(v => !v) },
      ],
    },
    {
      title: 'Privacy & Security',
      icon: Shield,
      items: [
        {
          label: 'Profile Visibility',
          description: 'Control who can see your profile',
          type: 'select',
          value: profileVisibility,
          onChange: setProfileVisibility,
          options: [
            { value: 'public', label: 'Public' },
            { value: 'connections', label: 'Connections Only' },
            { value: 'private', label: 'Private' },
          ],
        },
        { label: 'Show Location', description: 'Display your city on your profile', value: showLocation, onChange: () => setShowLocation(v => !v) },
      ],
    },
  ];

  const accountOptions = [
    { icon: Mail, label: 'Email Address', value: 'your@email.com', action: 'Change', onClick: () => setEmailModalOpen(true) },
    { icon: Lock, label: 'Password', value: '••••••••', action: 'Update', onClick: () => setPasswordModalOpen(true) },
    { icon: MapPin, label: 'Location', value: location, action: 'Edit', onClick: () => setLocationModalOpen(true) },
    { icon: Globe, label: 'Language', value: language === 'en-US' ? 'English (US)' : language, action: 'Change', onClick: () => setLanguageModalOpen(true) },
  ];

  // ── JSX — verbatim from Figma's SettingsPage.tsx ─────────────────────────────
  return (
    <AppShell>
      <div className="flex flex-1 flex-col bg-background min-h-0 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-12 py-8 w-full pb-24 lg:pb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
            <h1 className="text-5xl mb-2" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>Settings</h1>
            <p className="text-lg text-muted-foreground">Manage your account and preferences</p>
          </motion.div>

          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2 space-y-6">

              {/* Account Settings */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Lock size={18} className="text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Account Settings</h2>
                </div>
                <div className="space-y-4">
                  {accountOptions.map((option, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-accent/20 hover:bg-accent/5 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <option.icon size={16} className="text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground mb-0.5">{option.label}</div>
                          <div className="text-sm text-muted-foreground">{option.value}</div>
                        </div>
                      </div>
                      <button onClick={option.onClick} className="px-4 py-2 rounded-lg text-sm font-medium text-accent hover:bg-accent/10 transition-colors">
                        {option.action}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Notification + Privacy sections */}
              {settingsSections.map((section, sectionIndex) => (
                <motion.div key={sectionIndex} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + sectionIndex * 0.1 }}
                  className="bg-white rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <section.icon size={18} className="text-accent" />
                    </div>
                    <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>{section.title}</h2>
                  </div>
                  <div className="space-y-5">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-foreground mb-1">{item.label}</div>
                          <div className="text-sm text-muted-foreground">{item.description}</div>
                        </div>
                        {(item as any).type === 'select' ? (
                          <select value={item.value as string} onChange={e => (item.onChange as any)(e.target.value)}
                            className="px-4 py-2 rounded-lg border border-border bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20">
                            {((item as any).options || []).map((opt: any) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <button onClick={() => (item as any).onChange()} disabled={(item as any).disabled}
                            className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-40 ${item.value ? 'bg-accent' : 'bg-muted'}`}>
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${item.value ? 'translate-x-6' : 'translate-x-0.5'}`} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}

              {/* Appearance (theme toggle — not in original Figma but added) */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="bg-white rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Globe size={18} className="text-accent" />
                  </div>
                  <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Appearance</h2>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-foreground mb-1">Theme</div>
                    <div className="text-sm text-muted-foreground capitalize">{theme} mode</div>
                  </div>
                  <div className="flex items-center rounded-xl bg-muted p-1 gap-1">
                    <button onClick={() => theme === 'dark' && toggleTheme()} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${theme === 'light' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Light</button>
                    <button onClick={() => theme === 'light' && toggleTheme()} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${theme === 'dark' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Dark</button>
                  </div>
                </div>
              </motion.div>

              {/* Danger Zone */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="bg-white rounded-2xl p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-destructive/20">
                <h2 className="text-xl font-semibold mb-6 text-destructive" style={{ fontFamily: 'var(--font-heading)' }}>Danger Zone</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-destructive/20">
                    <div>
                      <div className="font-medium text-foreground mb-1">Deactivate Account</div>
                      <div className="text-sm text-muted-foreground">Temporarily disable your account</div>
                    </div>
                    <button onClick={() => setDeactivateDialogOpen(true)} className="px-4 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">Deactivate</button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-destructive/20">
                    <div>
                      <div className="font-medium text-foreground mb-1">Delete Account</div>
                      <div className="text-sm text-muted-foreground">Permanently delete your account and data</div>
                    </div>
                    <button onClick={() => setDeleteDialogOpen(true)} className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors">Delete</button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-destructive/20">
                    <div>
                      <div className="font-medium text-foreground mb-1">Sign Out</div>
                      <div className="text-sm text-muted-foreground">Sign out of your account</div>
                    </div>
                    <button onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Sign Out</button>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Sidebar — verbatim from Figma */}
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-accent to-orange-600 rounded-2xl p-6 text-white shadow-[0_8px_32px_rgba(232,71,10,0.2)]">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-4">
                  <CreditCard size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>Upgrade to Premium</h3>
                <p className="text-sm text-white/90 mb-4">Unlock unlimited swipes, see who liked you, and get priority placement in group chats.</p>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="w-full bg-white text-accent rounded-xl py-3 font-semibold hover:bg-white/90 transition-colors">
                  Upgrade Now
                </motion.button>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <h3 className="text-sm font-semibold text-foreground mb-4">Account Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Account Type</div>
                    <span className="text-sm font-medium text-foreground">Free</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Member Since</div>
                    <span className="text-sm font-medium text-foreground">Jan 2026</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Profile Completeness</div>
                    <span className="text-sm font-medium text-accent">85%</span>
                  </div>
                  <div className="pt-2">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-accent rounded-full h-2" style={{ width: '85%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Add bio to reach 100%</p>
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <h3 className="text-sm font-semibold text-foreground mb-4">Support</h3>
                <div className="space-y-3">
                  {['Help Center', 'Privacy Policy', 'Terms of Service', 'Contact Support'].map(item => (
                    <button key={item} className="w-full text-left text-sm text-muted-foreground hover:text-accent transition-colors">{item}</button>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Change Modal — from Figma */}
      <Modal isOpen={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="Change Email Address">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">New Email Address</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="your.new.email@example.com"
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Confirm Password</label>
            <input type="password" placeholder="Enter your password"
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <button onClick={handleChangeEmail} disabled={saving} className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50">
            {saving ? 'Sending…' : 'Update Email'}
          </button>
        </div>
      </Modal>

      {/* Password Change Modal — from Figma */}
      <Modal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title="Update Password">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Current Password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password"
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password"
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password"
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <button onClick={handleChangePassword} disabled={saving} className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50">
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </Modal>

      {/* Location Modal — from Figma */}
      <Modal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)} title="Edit Location">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">City, State</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Brooklyn, NY"
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <button onClick={() => { toast.success('Location saved'); setLocationModalOpen(false); }}
            className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-colors">
            Save Location
          </button>
        </div>
      </Modal>

      {/* Language Modal — from Figma */}
      <Modal isOpen={languageModalOpen} onClose={() => setLanguageModalOpen(false)} title="Change Language">
        <div className="space-y-3">
          {[{ value: 'en-US', label: 'English (US)' }, { value: 'en-GB', label: 'English (UK)' }, { value: 'es', label: 'Español' }, { value: 'fr', label: 'Français' }, { value: 'de', label: 'Deutsch' }].map(lang => (
            <button key={lang.value} onClick={() => { setLanguage(lang.value); setLanguageModalOpen(false); toast.success(`Language set to ${lang.label}`); }}
              className={`w-full p-4 rounded-xl text-left transition-colors ${language === lang.value ? 'bg-accent text-white' : 'border border-border hover:bg-muted'}`}>
              {lang.label}
            </button>
          ))}
        </div>
      </Modal>

      {/* Confirm Dialogs — from Figma's ConfirmDialog.tsx */}
      <ConfirmDialog isOpen={deactivateDialogOpen} onClose={() => setDeactivateDialogOpen(false)}
        onConfirm={() => toast.info('Deactivation requested — contact support')}
        title="Deactivate Account?" message="Your account will be temporarily disabled. You can reactivate it anytime by logging back in."
        confirmText="Deactivate" confirmVariant="danger" />

      <ConfirmDialog isOpen={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}
        onConfirm={async () => {
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
          toast.success('Account deleted'); navigate('/');
        }}
        title="Delete Account?" message="This action cannot be undone. All your data, matches, and chat history will be permanently deleted."
        confirmText="Delete Forever" confirmVariant="danger" />
    </AppShell>
  );
}

// ── Modal — from Figma's Modal.tsx ───────────────────────────────────────────
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
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"><X size={20} /></button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── ConfirmDialog — from Figma's ConfirmDialog.tsx ───────────────────────────
function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmVariant = 'primary' }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmText?: string; confirmVariant?: 'danger' | 'primary';
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${confirmVariant === 'danger' ? 'bg-destructive/10' : 'bg-accent/10'}`}>
                  <AlertTriangle size={24} className={confirmVariant === 'danger' ? 'text-destructive' : 'text-accent'} />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>
                  <p className="text-sm text-muted-foreground">{message}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border hover:bg-muted transition-colors font-medium">Cancel</button>
                <button onClick={() => { onConfirm(); onClose(); }}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${confirmVariant === 'danger' ? 'bg-destructive text-white hover:bg-destructive/90' : 'bg-accent text-white hover:bg-accent/90'}`}>
                  {confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
