'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/utils';
import { IconPlay, IconPlus, IconArrowRight, IconHeart, IconHistory, IconLogOut, IconRadio, IconMic, IconFilm } from '@/components/ui/Icons';

const SECRET_SEQ = 'heart';

/* ─── Floating Orbs Background ─── */
function FloatingOrbs() {
  return (
    <div className="orbs-container">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
    </div>
  );
}

/* ─── Animated Grid Background ─── */
function GridBackground() {
  return (
    <div className="grid-bg">
      <div className="grid-lines" />
      <div className="grid-fade" />
    </div>
  );
}

/* ─── Feature Pill ─── */
function FeaturePill({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  return (
    <motion.div
      className="feature-pill"
      whileHover={{ y: -2, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="feature-pill-icon">{icon}</div>
      <div>
        <p className="feature-pill-label">{label}</p>
        <p className="feature-pill-detail">{detail}</p>
      </div>
    </motion.div>
  );
}

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

  const [showEE, setShowEE] = useState(false);
  const bufRef = useRef('');
  const clickRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      bufRef.current = (bufRef.current + e.key.toLowerCase()).slice(-20);
      if (bufRef.current.includes(SECRET_SEQ)) {
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
    if (clickRef.current >= 5) {
      clickRef.current = 0;
      triggerEE();
    }
  };

  const triggerEE = () => {
    setShowEE(true);
    setTimeout(() => setShowEE(false), 6000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setIsSubmitting(true);
    setAuthError('');
    try {
      await login(username.trim(), password.trim());
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
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
    } catch { /* handled */ }
    finally { setIsCreating(false); }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    router.push(`/room/${joinCode.trim()}`);
  };

  if (authLoading) {
    return (
      <div className="landing-loader">
        <div className="loader-ring">
          <div className="loader-ring-inner" />
        </div>
      </div>
    );
  }

  return (
    <div className="landing-root">
      <FloatingOrbs />
      <GridBackground />
      <div className="bg-noise" />

      <AnimatePresence>
        {showEE && <EasterEgg />}
      </AnimatePresence>

      {/* ─── Header ─── */}
      <header className="landing-header">
        <button
          onClick={handleLogoClick}
          className="logo-btn"
          id="logo-button"
        >
          <div className="logo-icon">
            <IconPlay size={11} />
          </div>
          <span className="logo-text">SyncWatch</span>
        </button>

        {user && (
          <nav className="header-nav">
            <button
              onClick={() => router.push('/history')}
              className="nav-link"
              id="history-link"
            >
              <IconHistory size={14} />
              <span className="nav-link-text">History</span>
            </button>
            <div className="nav-divider" />
            <div className="user-badge">
              <div className="user-avatar-sm">
                {user.username[0].toUpperCase()}
              </div>
              <span className="user-name-sm">{user.username}</span>
            </div>
            <button onClick={logout} className="nav-link logout-link" id="logout-btn">
              <IconLogOut size={14} />
            </button>
          </nav>
        )}
      </header>

      {/* ─── Main ─── */}
      <main className="landing-main">
        <AnimatePresence mode="wait">
          {!user ? (
            <AuthView
              key="auth"
              {...{ username, setUsername, password, setPassword, authError, isSubmitting, handleAuth }}
            />
          ) : (
            <DashboardView
              key="dashboard"
              user={user}
              tab={tab}
              setTab={setTab}
              roomName={roomName}
              setRoomName={setRoomName}
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              isCreating={isCreating}
              handleCreate={handleCreate}
              handleJoin={handleJoin}
            />
          )}
        </AnimatePresence>
      </main>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <p className="footer-text">built for us</p>
      </footer>
    </div>
  );
}

/* ─── Auth View ─── */

interface AuthViewProps {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  authError: string;
  isSubmitting: boolean;
  handleAuth: (e: React.FormEvent) => void;
}

function AuthView({ username, setUsername, password, setPassword, authError, isSubmitting, handleAuth }: AuthViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="auth-container"
    >
      {/* Hero */}
      <div className="auth-hero">
        <motion.div
          className="hero-badge"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <div className="hero-badge-dot" />
          <span>Private viewing rooms</span>
        </motion.div>

        <motion.h1
          className="hero-title"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Watch<br />
          <span className="hero-title-accent">together.</span>
        </motion.h1>

        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          Sync playback, voice chat, react in real-time.<br className="hidden-mobile" />
          One room — two screens.
        </motion.p>
      </div>

      {/* Auth Card */}
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
      >
        <form onSubmit={handleAuth} className="auth-form">
          <div className="input-group">
            <label className="input-label" htmlFor="auth-username">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="your name"
              className="input-field"
              required
              minLength={2}
              maxLength={50}
              autoComplete="username"
              id="auth-username"
            />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="auth-password">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="min 4 characters"
              className="input-field"
              required
              minLength={4}
              autoComplete="current-password"
              id="auth-password"
            />
          </div>

          <AnimatePresence>
            {authError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="auth-error"
              >
                {authError}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isSubmitting || !username.trim() || !password.trim()}
            className="btn-glow"
            id="auth-submit"
          >
            {isSubmitting ? (
              <span className="spinner" style={{ width: 16, height: 16 }} />
            ) : (
              <>
                <span>Enter</span>
                <IconArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <p className="auth-hint">New username = new account</p>
      </motion.div>

      {/* Features row */}
      <motion.div
        className="features-row"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <FeaturePill icon={<IconRadio size={15} />} label="Sync" detail="Real-time" />
        <FeaturePill icon={<IconMic size={15} />} label="Voice" detail="WebRTC" />
        <FeaturePill icon={<IconFilm size={15} />} label="Sources" detail="YT / HLS / MP4" />
      </motion.div>
    </motion.div>
  );
}

/* ─── Dashboard View ─── */

interface DashboardViewProps {
  user: { id: string; username: string };
  tab: 'create' | 'join';
  setTab: (t: 'create' | 'join') => void;
  roomName: string;
  setRoomName: (v: string) => void;
  joinCode: string;
  setJoinCode: (v: string) => void;
  isCreating: boolean;
  handleCreate: (e: React.FormEvent) => void;
  handleJoin: (e: React.FormEvent) => void;
}

function DashboardView({ user, tab, setTab, roomName, setRoomName, joinCode, setJoinCode, isCreating, handleCreate, handleJoin }: DashboardViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="dashboard-container"
    >
      {/* Welcome section */}
      <motion.div
        className="welcome-section"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className="welcome-avatar">
          <span>{user.username[0].toUpperCase()}</span>
          <div className="avatar-ring" />
        </div>
        <div className="welcome-text">
          <p className="welcome-greeting">Welcome back,</p>
          <h2 className="welcome-name">{user.username}</h2>
        </div>
        <div className="welcome-status">
          <div className="status-dot live" />
          <span>online</span>
        </div>
      </motion.div>

      {/* Room card */}
      <motion.div
        className="room-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {/* Tabs */}
        <div className="room-tabs">
          {(['create', 'join'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`room-tab ${tab === t ? 'active' : ''}`}
              id={`tab-${t}`}
            >
              {t === 'create' ? (
                <>
                  <IconPlus size={13} />
                  <span>New room</span>
                </>
              ) : (
                <>
                  <IconArrowRight size={13} />
                  <span>Join room</span>
                </>
              )}
              {tab === t && (
                <motion.div
                  layoutId="tab-indicator"
                  className="tab-indicator"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="room-tab-content">
          <AnimatePresence mode="wait">
            {tab === 'create' ? (
              <motion.form
                key="create"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleCreate}
                className="room-form"
              >
                <div className="input-group">
                  <label className="input-label" htmlFor="room-name-input">Room name</label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={e => setRoomName(e.target.value)}
                    placeholder="movie night"
                    className="input-field"
                    required
                    maxLength={100}
                    id="room-name-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreating || !roomName.trim()}
                  className="btn-glow"
                  id="create-room-btn"
                >
                  {isCreating ? (
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                  ) : (
                    <>
                      <IconPlus size={15} />
                      <span>Create room</span>
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="join"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleJoin}
                className="room-form"
              >
                <div className="input-group">
                  <label className="input-label" htmlFor="join-code-input">Room code</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    placeholder="paste room code"
                    className="input-field font-mono"
                    required
                    id="join-code-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="btn-glow"
                  id="join-room-btn"
                >
                  <IconArrowRight size={15} />
                  <span>Join</span>
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Features row */}
      <motion.div
        className="features-row"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      >
        <FeaturePill icon={<IconRadio size={15} />} label="Sync" detail="Real-time" />
        <FeaturePill icon={<IconMic size={15} />} label="Voice" detail="WebRTC" />
        <FeaturePill icon={<IconFilm size={15} />} label="Sources" detail="YT / HLS / MP4" />
      </motion.div>
    </motion.div>
  );
}

/* ─── Easter Egg ─── */

function EasterEgg() {
  const HEART_COUNT = 24;
  const SPARKLE_COUNT = 12;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="ee-overlay"
    >
      {/* Falling hearts */}
      {Array.from({ length: HEART_COUNT }).map((_, i) => (
        <motion.div
          key={`heart-${i}`}
          initial={{ y: -40, opacity: 0, rotate: -20 + Math.random() * 40 }}
          animate={{
            y: '110vh',
            opacity: [0, 0.8, 0.8, 0],
            rotate: -20 + Math.random() * 40,
          }}
          transition={{
            duration: 3.5 + Math.random() * 2.5,
            delay: i * 0.1,
            ease: 'easeIn',
          }}
          style={{
            position: 'absolute',
            left: `${(i / HEART_COUNT) * 100}%`,
            top: 0,
          }}
        >
          <IconHeart
            size={10 + Math.floor(Math.random() * 18)}
            className="ee-heart-icon"
          />
        </motion.div>
      ))}

      {/* Sparkle particles */}
      {Array.from({ length: SPARKLE_COUNT }).map((_, i) => (
        <motion.div
          key={`sparkle-${i}`}
          className="ee-sparkle"
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.2, 0],
          }}
          transition={{
            duration: 1.5,
            delay: 0.3 + i * 0.2,
            repeat: 2,
            repeatDelay: 0.5,
          }}
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
          }}
        />
      ))}

      {/* Center card */}
      <motion.div
        className="ee-card-wrapper"
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="ee-card">
          <div className="ee-card-glow" />

          <motion.p
            className="ee-tag"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            janym
          </motion.p>

          <motion.div
            className="ee-heart-main"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 200, damping: 12 }}
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <IconHeart size={32} className="ee-heart-accent" />
            </motion.div>
          </motion.div>

          <motion.h2
            className="ee-name"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            Dilnaz
          </motion.h2>

          <motion.p
            className="ee-message"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
          >
            You are my world.
          </motion.p>

          <motion.div
            className="ee-hearts-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <IconHeart size={10} className="ee-heart-sm" />
            <IconHeart size={14} className="ee-heart-sm" />
            <IconHeart size={10} className="ee-heart-sm" />
          </motion.div>

          <motion.p
            className="ee-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 1.1 }}
          >
            forever yours
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  );
}
