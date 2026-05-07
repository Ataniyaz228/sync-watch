'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/utils';
import { IconPlay, IconPlus, IconArrowRight, IconHeart } from '@/components/ui/Icons';

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
      if (bufRef.current.includes(SECRET)) { bufRef.current = ''; triggerEE(); }
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

  const triggerEE = () => { setShowEE(true); setTimeout(() => setShowEE(false), 6000); };

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

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--color-bg-0)]">
        <div className="spinner" style={{ width: 24, height: 24 }} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg-0)] flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="bg-noise" />
      <AnimatePresence>{showEE && <EasterEgg />}</AnimatePresence>

      {/* ── Nav ── */}
      <nav className="px-6 py-5 flex items-center justify-between">
        <button onClick={handleLogoClick} className="flex items-center gap-2.5 bg-transparent border-none cursor-pointer">
          <div className="w-8 h-8 rounded-lg surface-raised flex items-center justify-center">
            <IconPlay size={14} className="text-[var(--color-text-2)]" />
          </div>
          <span className="text-sm font-semibold text-[var(--color-text-0)] tracking-tight">SyncWatch</span>
        </button>
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-text-3)]">{user.username}</span>
            <button onClick={logout} className="text-[11px] text-[var(--color-text-4)] hover:text-[var(--color-error)] transition-colors">
              выйти
            </button>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      {!user ? (
        <main className="flex-1 flex flex-col items-center justify-center px-5 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
            className="w-full max-w-[360px]"
          >
            {/* Headline */}
            <div className="text-center mb-10">
              <h1 className="text-[2.2rem] font-semibold tracking-tight text-[var(--color-text-0)] leading-[1.15] mb-3">
                Смотрите вместе,<br />
                <span style={{ color: 'var(--color-text-3)' }}>где бы вы ни были</span>
              </h1>
              <p className="text-sm text-[var(--color-text-4)] leading-relaxed">
                Приватное пространство для двоих — синхронный просмотр, чат и голос.
              </p>
            </div>

            {/* Auth card */}
            <div className="surface rounded-2xl p-6">
              <p className="text-xs text-[var(--color-text-4)] mb-4">Войдите или создайте аккаунт</p>
              <form onSubmit={handleAuth} className="space-y-3">
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Имя пользователя" className="input-field" required minLength={2} maxLength={50}
                  autoComplete="username" id="auth-username"
                />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Пароль (мин. 4 символа)" className="input-field" required minLength={4}
                  autoComplete="current-password" id="auth-password"
                />
                {authError && <p className="text-[var(--color-error)] text-xs">{authError}</p>}
                <button type="submit" disabled={isSubmitting || !username.trim() || !password.trim()}
                  className="btn-primary w-full flex items-center justify-center gap-2" id="auth-submit">
                  {isSubmitting
                    ? <span className="spinner" style={{ width: 14, height: 14 }} />
                    : <><span>Войти</span><IconArrowRight size={14} /></>}
                </button>
              </form>
            </div>

            <p className="text-center text-[10px] text-[var(--color-text-4)] mt-6 tracking-widest uppercase">
              сделано для нас двоих
            </p>
          </motion.div>
        </main>
      ) : (
        <main className="flex-1 flex flex-col px-5 pb-16 pt-4">
          <div className="max-w-[420px] mx-auto w-full space-y-3">

            {/* Welcome */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className="surface rounded-2xl px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl surface-raised flex items-center justify-center text-sm font-bold text-[var(--color-text-2)]">
                  {user.username[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-0)]">{user.username}</p>
                  <div className="flex items-center gap-1.5">
                    <div className="status-dot live" />
                    <p className="text-[11px] text-[var(--color-text-4)]">онлайн</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Tabs */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }}
              className="surface rounded-2xl overflow-hidden">
              {/* Tab headers */}
              <div className="grid grid-cols-2 border-b border-[var(--color-border)]">
                {(['create', 'join'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} id={`tab-${t}`}
                    className={`py-3.5 text-xs font-medium tracking-wide transition-colors relative ${
                      tab === t ? 'text-[var(--color-text-0)]' : 'text-[var(--color-text-4)] hover:text-[var(--color-text-2)]'
                    }`}>
                    {t === 'create' ? 'Создать комнату' : 'Войти в комнату'}
                    {tab === t && (
                      <motion.div layoutId="tab-line" className="absolute bottom-0 left-4 right-4 h-[1.5px] bg-[var(--color-text-0)]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="p-5">
                <AnimatePresence mode="wait">
                  {tab === 'create' ? (
                    <motion.form key="c" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }}
                      onSubmit={handleCreate} className="space-y-3">
                      <div>
                        <label className="label">Название</label>
                        <input type="text" value={roomName} onChange={e => setRoomName(e.target.value)}
                          placeholder="movie night ✨" className="input-field" required maxLength={100} id="room-name-input" />
                      </div>
                      <button type="submit" disabled={isCreating || !roomName.trim()}
                        className="btn-primary w-full flex items-center justify-center gap-2" id="create-room-btn">
                        {isCreating ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><IconPlus size={14} /><span>Создать</span></>}
                      </button>
                    </motion.form>
                  ) : (
                    <motion.form key="j" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }}
                      onSubmit={handleJoin} className="space-y-3">
                      <div>
                        <label className="label">Код комнаты</label>
                        <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)}
                          placeholder="вставьте код" className="input-field font-mono" required id="join-code-input" />
                      </div>
                      <button type="submit" disabled={!joinCode.trim()}
                        className="btn-primary w-full flex items-center justify-center gap-2" id="join-room-btn">
                        <IconArrowRight size={14} /><span>Войти</span>
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Features */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12, duration: 0.4 }}
              className="grid grid-cols-3 gap-2">
              {[
                { label: 'Любой источник', sub: 'YouTube, HLS, MP4' },
                { label: 'Живая синхронизация', sub: 'sub-секундная' },
                { label: 'Голос + чат', sub: 'WebRTC' },
              ].map(f => (
                <div key={f.label} className="surface-raised rounded-xl p-3">
                  <p className="text-[11px] font-medium text-[var(--color-text-2)] leading-tight mb-0.5">{f.label}</p>
                  <p className="text-[10px] text-[var(--color-text-4)]">{f.sub}</p>
                </div>
              ))}
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}
              className="text-center text-[10px] text-[var(--color-text-4)] tracking-widest uppercase pt-2">
              сделано для нас двоих
            </motion.p>
          </div>
        </main>
      )}
    </div>
  );
}

function EasterEgg() {
  const count = 22;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        pointerEvents: 'none', overflow: 'hidden',
      }}
    >
      {/* Falling hearts */}
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i}
          initial={{ x: `${(i / count) * 100}vw`, y: -40, opacity: 0 }}
          animate={{ y: '110vh', opacity: [0, 1, 1, 0] }}
          transition={{ duration: 3.5 + Math.random() * 2, delay: i * 0.1, ease: 'easeIn' }}
          style={{ position: 'absolute', top: 0, left: 0 }}>
          <span style={{ opacity: 0.6 + Math.random() * 0.4 }}>
            <IconHeart
              size={12 + Math.floor(Math.random() * 16)}
              className="text-[var(--color-accent)]"
            />
          </span>
        </motion.div>
      ))}

      {/* Card — perfectly centered */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ delay: 0.25, duration: 0.55, ease: [0.25, 1, 0.5, 1] as const }}
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(340px, 88vw)',
          zIndex: 10000,
          pointerEvents: 'none',
        }}
      >
        <div
          className="surface rounded-2xl text-center"
          style={{
            padding: '28px 24px 24px',
            border: '1px solid rgba(167,139,250,0.25)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.3)',
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-4)] mb-4">жаным</p>
          <p className="text-[2rem] font-semibold tracking-tight text-[var(--color-text-0)] mb-1">
            Дильназ
          </p>
          <p className="text-sm text-[var(--color-text-2)] leading-relaxed mb-5">
            Ты — мой мир.<br />
            <span className="text-[var(--color-text-4)]">Смотреть с тобой — лучшее.</span>
          </p>
          <div className="flex justify-center gap-3">
            <IconHeart size={16} className="text-[var(--color-accent)]" />
            <IconHeart size={20} className="text-[var(--color-accent)]" />
            <IconHeart size={16} className="text-[var(--color-accent)]" />
          </div>
          <p className="text-[10px] text-[var(--color-text-4)] mt-4 tracking-widest">forever yours</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
