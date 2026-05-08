'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/utils';
import type { VideoResolution } from '@/types';
import { IconLink, IconPlay, IconCheck } from '@/components/ui/Icons';

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
  if (url.includes('youtube.com') || url.includes('youtu.be')) return '▶';
  if (url.includes('vk.com')) return 'В';
  if (url.includes('.m3u8')) return '〜';
  if (url.includes('.mp4')) return '▣';
  return '🔗';
}

function timeAgoShort(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const HISTORY_KEY = 'sw_url_history';

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
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

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

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
      if (mode === 'queue') {
        onAddToQueue(result);
      } else {
        onVideoResolved(result);
      }
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); resolve(url); };
  const handleHistoryClick = (h: HistoryEntry) => { setUrl(h.url); resolve(h.url); };

  return (
    <div className="mob-url-wrap">
      <p className="mob-url-title">Add video</p>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('play')}
          className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all border ${mode === 'play' ? 'bg-[var(--color-accent)] text-black border-[var(--color-accent)]' : 'bg-[var(--color-bg-2)] text-[var(--color-text-2)] border-[var(--color-border)]'}`}
        >
          {isHost ? 'Play now' : 'Suggest'}
        </button>
        <button
          onClick={() => setMode('queue')}
          className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all border ${mode === 'queue' ? 'bg-[var(--color-accent)] text-black border-[var(--color-accent)]' : 'bg-[var(--color-bg-2)] text-[var(--color-text-2)] border-[var(--color-border)]'}`}
        >
          Add to queue
        </button>
      </div>

      {/* URL Input */}
      <form onSubmit={handleSubmit}>
        <div className="mob-url-input-box">
          <IconLink size={15} className="text-[var(--color-text-4)] shrink-0" />
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(''); }}
            placeholder="YouTube, VK, .m3u8, .mp4..."
            autoComplete="off"
            id="mob-url-input"
          />
          {url && (
            <button type="button" onClick={() => setUrl('')}
              className="text-[var(--color-text-4)] text-[10px] px-2 py-1 rounded-md bg-[var(--color-bg-3)] shrink-0">
              ✕
            </button>
          )}
        </div>

        {error && <p className="text-[var(--color-error)] text-[11px] mb-3 px-1">{error}</p>}

        <button type="submit" disabled={!url.trim() || isLoading} className="mob-url-go" id="mob-url-go">
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <><IconPlay size={14} /> {mode === 'queue' ? 'Add to queue' : isHost ? 'Play' : 'Suggest'}</>
          )}
        </button>
      </form>

      {/* History */}
      {history.length > 0 && (
        <>
          <p className="mob-hist-label">Recent</p>
          {history.map((h, i) => (
            <div key={i} className="mob-hist-item" onClick={() => handleHistoryClick(h)}>
              <div className="mob-hist-icon">
                <span className="text-[12px] text-[var(--color-text-3)]">{getUrlIcon(h.url)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mob-hist-url">{h.url}</div>
                <div className="mob-hist-time">{timeAgoShort(h.resolvedAt)}</div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-4)] shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
