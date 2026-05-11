'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import type { VideoPlayerAPI } from '@/hooks/useVideoSync';

interface YouTubePlayerProps {
  videoId: string;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeeked?: (time: number) => void;
  onReady?: () => void;
}

const YouTubePlayer = forwardRef<VideoPlayerAPI, YouTubePlayerProps>(
  ({ videoId, onPlay, onPause, onSeeked, onReady }, ref) => {
    const ytPlayerRef = useRef<YT.Player | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [, setReadyFlag] = useState(false);
    const lastTimeRef = useRef(0);

    // Store callbacks in refs — no dependency churn
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onSeekedRef = useRef(onSeeked);
    const onReadyRef = useRef(onReady);
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
    onSeekedRef.current = onSeeked;
    onReadyRef.current = onReady;

    useImperativeHandle(ref, () => ({
      play: () => { try { ytPlayerRef.current?.playVideo(); } catch {} },
      pause: () => { try { ytPlayerRef.current?.pauseVideo(); } catch {} },
      seek: (time: number) => { try { ytPlayerRef.current?.seekTo(time, true); } catch {} },
      getCurrentTime: () => { try { return ytPlayerRef.current?.getCurrentTime() ?? 0; } catch { return 0; } },
      // Fix: state 3 (buffering) is also "playing"
      isPlaying: () => {
        try {
          const s = ytPlayerRef.current?.getPlayerState();
          return s === 1 || s === 3; // PLAYING or BUFFERING
        } catch { return false; }
      },
      // YouTube only supports discrete rates; round to nearest available
      setPlaybackRate: (rate: number) => {
        try {
          const available = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
          const nearest = available.reduce((a, b) => Math.abs(b - rate) < Math.abs(a - rate) ? b : a);
          ytPlayerRef.current?.setPlaybackRate(nearest);
        } catch {}
      },
    }));

    useEffect(() => {
      let destroyed = false;

      const createPlayer = () => {
        if (destroyed || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        const playerDiv = document.createElement('div');
        containerRef.current.appendChild(playerDiv);

        ytPlayerRef.current = new YT.Player(playerDiv, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (!destroyed) {
                setReadyFlag(true);
                onReadyRef.current?.();
              }
            },
            onStateChange: (event: YT.OnStateChangeEvent) => {
              if (destroyed) return;
              const time = ytPlayerRef.current?.getCurrentTime() ?? 0;
              switch (event.data) {
                case 1: // PLAYING
                  onPlayRef.current?.(time);
                  break;
                case 2: // PAUSED
                  onPauseRef.current?.(time);
                  break;
              }
              const drift = Math.abs(time - lastTimeRef.current);
              if (drift > 1 && event.data === 1) {
                onSeekedRef.current?.(time);
              }
              lastTimeRef.current = time;
            },
          },
        });
      };

      if (!window.YT || !window.YT.Player) {
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          tag.async = true;
          document.body.appendChild(tag);
        }
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          prev?.();
          createPlayer();
        };
      } else {
        createPlayer();
      }

      return () => {
        destroyed = true;
        setReadyFlag(false);
        try { ytPlayerRef.current?.destroy(); } catch {}
        ytPlayerRef.current = null;
      };
    }, [videoId]);

    // Track time for seek detection
    useEffect(() => {
      const interval = setInterval(() => {
        try { lastTimeRef.current = ytPlayerRef.current?.getCurrentTime() ?? 0; } catch {}
      }, 500);
      return () => clearInterval(interval);
    }, []);

    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#000' }} />
    );
  }
);

YouTubePlayer.displayName = 'YouTubePlayer';
export default YouTubePlayer;
