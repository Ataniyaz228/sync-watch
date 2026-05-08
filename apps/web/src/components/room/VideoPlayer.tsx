'use client';

import { useRef, useCallback } from 'react';
import HlsPlayer from './HlsPlayer';
import YouTubePlayer from './YouTubePlayer';
import NativePlayer from './NativePlayer';
import IframePlayer from './IframePlayer';
import type { VideoType } from '@/types';
import type { VideoPlayerAPI } from '@/hooks/useVideoSync';

interface VideoPlayerProps {
  type: VideoType | null;
  url: string;
  title?: string;
  onPlay: (time: number) => void;
  onPause: (time: number) => void;
  onSeeked: (time: number) => void;
  playerRef: React.MutableRefObject<VideoPlayerAPI | null>;
}

export default function VideoPlayer({ type, url, title, onPlay, onPause, onSeeked, playerRef }: VideoPlayerProps) {
  const internalRef = useRef<VideoPlayerAPI>(null);

  const setRef = useCallback((api: VideoPlayerAPI | null) => {
    (internalRef as React.MutableRefObject<VideoPlayerAPI | null>).current = api;
    playerRef.current = api;
  }, [playerRef]);

  if (!type || !url) {
    return null;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000', overflow: 'hidden' }}>
      {title && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
          padding: '8px 16px',
        }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{title}</p>
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0 }}>
        {type === 'hls' && <HlsPlayer ref={setRef} src={url} onPlay={onPlay} onPause={onPause} onSeeked={onSeeked} />}
        {type === 'youtube' && <YouTubePlayer ref={setRef} videoId={url} onPlay={onPlay} onPause={onPause} onSeeked={onSeeked} />}
        {type === 'mp4' && <NativePlayer ref={setRef} src={url} onPlay={onPlay} onPause={onPause} onSeeked={onSeeked} />}
        {type === 'iframe' && <IframePlayer ref={setRef} src={url} onPlay={onPlay} onPause={onPause} onSeeked={onSeeked} />}
      </div>
    </div>
  );
}
