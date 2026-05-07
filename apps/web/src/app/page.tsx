'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/utils';
import { IconPlay, IconPlus, IconArrowRight, IconHeart, IconZap, IconRadio, IconFilm, IconMic, IconChat } from '@/components/ui/Icons';

const SECRET = 'heart';

export default function HomePage() {
  const router = useRouter();
  const { user, login, logout, isLoading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [tab, setTab] = useState<'create' | 'join'>('create');

  // Easter egg
  const [showEE, setShowEE] = useState(false);
  const bufRef = useRef('');
  const clickRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      bufRef.current = (bufRef.current + e.key.toLowerCase()).slice(-20);
      if (bufRef.current.includes(SECRET)) {
        bufRef.current = '';
        triggerEE();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogoClick = () => {
    clickRef.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { clickRef.current = 0; }, 2000);
    if (clickRef.current >= 5) { clickRef.current = 0; triggerEE(); }
  };

  const triggerEE = () => { setShowEE(true); setTimeout(() => setShowEE(false), 5000); };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setIsSubmitting(true);
    setAuthError('');
    try { await login(username.trim(), password.trim()); }
    catch (err) { setAuthError(err instanceof Error ? err.message : 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setIsCreating(true);
    try {
      const room = await apiRequest<{ slug: string }>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: roomName.trim(), userId: user?.id }),
      });
      router.push(`/room/${room.slug}`);
    } catch { /* */ }
    finally { setIsCreating(false); }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    router.push(`/room/${joinCode.trim()}`);
  };

  const fade = {
    hidden: { opacity: 0, y: 16 },
    show: (i: number) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.5, delay: i * 0.07, ease: [0.25, 1, 0.5, 1] as const },
    }),
  };

  if (authLoading) {
    return <div className="min-h-dvh flex items-center justify-center"><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-12">
      <div className="bg-noise" />
      <AnimatePresence>{showEE && <EasterEgg />}</AnimatePresence>

      <motion.div initial="hidden" animate="show" className="w-full max-w-sm mx-auto">
        {/* Logo */}
        <motion.div custom={0} variants={fade} className="text-center mb-10">
          <button onClick={handleLogoClick} className="inline-flex items-center gap-3 mb-5 bg-transparent border-none cursor-pointer">
            <div className="w-11 h-11 rounded-lg surface-raised flex items-center justify-center">
              <IconPlay size={20} className="text-[var(--color-text-2)]" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-0)]">
                SyncWatch
              </h1>
              <p className="text-[10px] text-[var(--color-text-4)] tracking-[0.15em] uppercase font-mono">watch together</p>
            </div>
          </button>
          <p className="text-[var(--color-text-2)] text-sm leading-relaxed max-w-xs mx-auto">
            A private space for watching videos in sync with live chat and voice.
          </p>
        </motion.div>

        {/* Feature grid */}
        <motion.div custom={1} variants={fade} className="grid grid-cols-3 gap-2 mb-8">
          {[
            { icon: <IconFilm size={15} />, label: 'Any source' },
            { icon: <IconZap size={15} />, label: 'Live sync' },
            { icon: <IconRadio size={15} />, label: 'HLS' },
            { icon: <IconMic size={15} />, label: 'Voice' },
            { icon: <IconChat size={15} />, label: 'Chat' },
            { icon: <IconHeart size={15} />, label: 'Reactions' },
          ].map((f) => (
            <div key={f.label} className="surface-raised rounded-lg px-3 py-2.5 flex items-center gap-2">
              <span className="text-[var(--color-text-3)]">{f.icon}</span>
              <span className="text-xs text-[var(--color-text-2)]">{f.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Auth or Rooms */}
        {!user ? (
          <motion.div custom={2} variants={fade} className="surface rounded-xl p-6">
            <h2 className="text-sm font-semibold text-[var(--color-text-0)] mb-1">Sign in</h2>
            <p className="text-xs text-[var(--color-text-3)] mb-5">Enter your credentials or create a new account.</p>

            <form onSubmit={handleAuth} className="space-y-3">
              <div>
                <label className="label">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="your name" className="input-field" required minLength={2} maxLength={50}
                  autoComplete="username" id="auth-username" />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="min 4 characters" className="input-field" required minLength={4}
                  autoComplete="current-password" id="auth-password" />
              </div>

              {authError && (
                <p className="text-[var(--color-error)] text-xs">{authError}</p>
              )}

              <button type="submit" disabled={isSubmitting || !username.trim() || !password.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2" id="auth-submit">
                {isSubmitting ? <span className="spinner" /> : <>Enter <IconArrowRight size={14} /></>}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div custom={2} variants={fade} className="space-y-3">
            {/* Status bar */}
            <div className="surface rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="status-dot live" />
                <span className="text-sm text-[var(--color-text-2)]">{user.username}</span>
              </div>
              <button onClick={logout} className="text-xs text-[var(--color-text-4)] hover:text-[var(--color-error)] transition-colors">
                Sign out
              </button>
            </div>

            {/* Tabs */}
            <div className="surface rounded-xl overflow-hidden">
              <div className="flex border-b border-[var(--color-border)]">
                {(['create', 'join'] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-3 text-xs font-medium tracking-wide uppercase transition-colors relative ${
                      tab === t ? 'text-[var(--color-text-0)]' : 'text-[var(--color-text-4)] hover:text-[var(--color-text-2)]'
                    }`} id={`tab-${t}`}>
                    {t === 'create' ? 'Create room' : 'Join room'}
                    {tab === t && (
                      <motion.div layoutId="tab-line"
                        className="absolute bottom-0 left-0 right-0 h-px bg-[var(--color-text-0)]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="p-5">
                <AnimatePresence mode="wait">
                  {tab === 'create' ? (
                    <motion.form key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onSubmit={handleCreate} className="space-y-3">
                      <div>
                        <label className="label">Room name</label>
                        <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)}
                          placeholder="movie night" className="input-field" required maxLength={100} id="room-name-input" />
                      </div>
                      <button type="submit" disabled={isCreating || !roomName.trim()}
                        className="btn-primary w-full flex items-center justify-center gap-2" id="create-room-btn">
                        {isCreating ? <span className="spinner" /> : <><IconPlus size={14} /> Create</>}
                      </button>
                    </motion.form>
                  ) : (
                    <motion.form key="j" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onSubmit={handleJoin} className="space-y-3">
                      <div>
                        <label className="label">Room code</label>
                        <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                          placeholder="paste code" className="input-field font-mono" required id="join-code-input" />
                      </div>
                      <button type="submit" disabled={!joinCode.trim()}
                        className="btn-primary w-full flex items-center justify-center gap-2" id="join-room-btn">
                        <IconArrowRight size={14} /> Join
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        <motion.p custom={3} variants={fade} className="text-center mt-8 text-[10px] text-[var(--color-text-4)] tracking-wider uppercase">
          Made for us
        </motion.p>
      </motion.div>
    </main>
  );
}

function EasterEgg() {
  const hearts = Array.from({ length: 20 });
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="heart-rain">
      {hearts.map((_, i) => (
        <motion.div key={i}
          initial={{ left: `${Math.random() * 100}%`, top: '-5%', opacity: 0 }}
          animate={{ top: '105%', opacity: [0, 0.7, 0.7, 0] }}
          transition={{ duration: 3 + Math.random() * 2, delay: i * 0.12, ease: 'easeOut' }}
          style={{ position: 'absolute' }}>
          <IconHeart size={16 + Math.random() * 14} className="text-[var(--color-accent)]" />
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.25, 1, 0.5, 1] as const }}
        className="ee-center">
        <p className="text-3xl sm:text-4xl font-semibold text-[var(--color-text-0)] tracking-tight mb-1">
          Ты — мой мир
        </p>
        <p className="text-sm text-[var(--color-accent)]">forever yours</p>
      </motion.div>
    </motion.div>
  );
}
