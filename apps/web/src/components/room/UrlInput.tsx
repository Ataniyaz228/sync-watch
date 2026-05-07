'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/utils';
import type { VideoResolution } from '@/types';
import { IconPlay } from '@/components/ui/Icons';

interface UrlInputProps {
  onVideoResolved: (resolution: VideoResolution) => void;
  disabled?: boolean;
}

export default function UrlInput({ onVideoResolved, disabled }: UrlInputProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    
    // Prevent room inception
    if (url.includes(window.location.host)) {
      setError('Cannot play a SyncWatch room inside another room :)');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await apiRequest<VideoResolution>('/api/videos/resolve', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      });
      onVideoResolved(result);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input type="text" value={url} onChange={(e) => { setUrl(e.target.value); setError(''); }}
            placeholder="Paste video URL — YouTube, .m3u8, .mp4, embed"
            className="input-field text-sm" disabled={disabled || isLoading} id="url-input" />
          {isLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="spinner" /></div>}
        </div>
        <button type="submit" disabled={!url.trim() || isLoading || disabled}
          className="btn-primary px-4 py-2.5 text-sm flex items-center gap-1.5" id="resolve-btn">
          <IconPlay size={13} /> Load
        </button>
      </div>
      {error && <p className="text-[var(--color-error)] text-[11px] px-0.5">{error}</p>}
    </form>
  );
}
