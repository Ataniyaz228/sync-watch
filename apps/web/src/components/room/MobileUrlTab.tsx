'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/utils';
import type { VideoResolution } from '@/types';

interface HistoryEntry {
  url: string;
  resolvedAt: string;
  type: string;
}

interface MobileUrlTabProps {
  onVideoResolved: (r: VideoResolution) => void;
  onAddToQueue: (r: VideoResolution) => void;
  isHost: boolean;
}

function getUrlIcon(url: string) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'ti ti-brand-youtube';
  if (url.includes('vk.com')) return 'ti ti-brand-vk';
  if (url.includes('.m3u8')) return 'ti ti-broadcast';
  if (url.includes('.mp4')) return 'ti ti-file-type-mp4';
  return 'ti ti-link';
}

function timeAgoShort(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const HISTORY_KEY = 'sw_url_history';

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveHistory(url: string, type: string) {
  const existing = loadHistory().filter(h => h.url !== url);
  const next = [{ url, type, resolvedAt: new Date().toISOString() }, ...existing].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export default function MobileUrlTab({ onVideoResolved, onAddToQueue, isHost }: MobileUrlTabProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mode, setMode] = useState<'play' | 'queue'>('play');

  useEffect(() => { setHistory(loadHistory()); }, []);

  const resolve = async (inputUrl: string) => {
    const u = inputUrl.trim();
    if (!u || isLoading) return;
    if (u.includes(window.location.host)) {
      setError('Cannot play a SyncWatch room inside another room');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await apiRequest<VideoResolution>('/api/videos/resolve', {
        method: 'POST',
        body: JSON.stringify({ url: u }),
      });
      saveHistory(u, result.type);
      setHistory(loadHistory());
      if (mode === 'queue') { onAddToQueue(result); }
      else { onVideoResolved(result); }
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); resolve(url); };

  return (
    <div className="mob-url-sc">
      <div className="mob-url-sc-ttl">ссылка</div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => setMode('play')}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 20, fontSize: 11, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
            background: mode === 'play' ? '#A8B8C4' : 'transparent',
            color: mode === 'play' ? '#0a151a' : '#777',
            border: mode === 'play' ? '1px solid #A8B8C4' : '1px solid #1a1a1a',
          }}
        >
          {isHost ? 'Играть' : 'Предложить'}
        </button>
        <button
          onClick={() => setMode('queue')}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 20, fontSize: 11, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
            background: mode === 'queue' ? '#A8B8C4' : 'transparent',
            color: mode === 'queue' ? '#0a151a' : '#777',
            border: mode === 'queue' ? '1px solid #A8B8C4' : '1px solid #1a1a1a',
          }}
        >
          В очередь
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mob-url-inp-wrap">
          <i className="ti ti-link" />
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(''); }}
            placeholder="youtube, vk, m3u8, mp4..."
            autoComplete="off"
            id="mob-url-input"
          />
          {url && (
            <button type="button" className="mob-url-paste" onClick={() => setUrl('')}>
              очистить
            </button>
          )}
          {!url && (
            <button
              type="button"
              className="mob-url-paste"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  setUrl(text);
                } catch {}
              }}
            >
              вставить
            </button>
          )}
        </div>

        {error && (
          <p style={{ fontSize: 11, color: '#E5584F', marginBottom: 8, paddingLeft: 2 }}>{error}</p>
        )}

        <button type="submit" disabled={!url.trim() || isLoading} className="mob-url-go-btn" id="mob-url-go">
          {isLoading ? (
            <div style={{
              width: 14, height: 14, border: '2px solid rgba(10,21,26,0.25)',
              borderTop: '2px solid #0a151a', borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }} />
          ) : (
            <><i className="ti ti-player-play" style={{ fontSize: 14 }} />смотреть</>
          )}
        </button>
      </form>

      {history.length > 0 && (
        <>
          <div className="mob-hist-lbl">недавнее</div>
          {history.map((h, i) => (
            <div key={i} className="mob-hi" onClick={() => { setUrl(h.url); resolve(h.url); }}>
              <i className={`${getUrlIcon(h.url)} mob-hi-icon`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mob-hi-url">{h.url}</div>
                <div className="mob-hi-when">{timeAgoShort(h.resolvedAt)}</div>
              </div>
              <i className="ti ti-chevron-right mob-hi-arr" />
            </div>
          ))}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
