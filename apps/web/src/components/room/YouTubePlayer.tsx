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
    const lastTimeRef = useRef(0);
    const [, setTick] = useState(0);

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
      isPlaying: () => {
        try {
          const s = ytPlayerRef.current?.getPlayerState();
          return s === 1 || s === 3; // playing or buffering
        } catch { return false; }
      },
    }));

    // Destroy + recreate on EVERY videoId change — this guarantees onReady fires
    useEffect(() => {
      let destroyed = false;

      const createPlayer = () => {
        if (destroyed || !containerRef.current) return;

        // Clear any previous player DOM
        containerRef.current.innerHTML = '';
        const playerDiv = document.createElement('div');
        containerRef.current.appendChild(playerDiv);

        const player = new YT.Player(playerDiv, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0, // NO autoplay — let sync logic control this
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (destroyed) return;
              ytPlayerRef.current = player;
              setTick(t => t + 1); // force re-render so ref updates
              onReadyRef.current?.();
            },
            onStateChange: (event: YT.OnStateChangeEvent) => {
              if (destroyed) return;
              const time = player.getCurrentTime?.() ?? 0;
              switch (event.data) {
                case 1: // PLAYING
                  onPlayRef.current?.(time);
                  break;
                case 2: // PAUSED
                  onPauseRef.current?.(time);
                  break;
              }
              // Seek detection: if time jumped > 2s since last check
              const drift = Math.abs(time - lastTimeRef.current);
              if (drift > 2 && event.data === 1) {
                onSeekedRef.current?.(time);
              }
              lastTimeRef.current = time;
            },
          },
        });
      };

      // Ensure YT API is loaded
      if (!window.YT || !window.YT.Player) {
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          tag.async = true;
          document.body.appendChild(tag);
        }
        const poll = setInterval(() => {
          if (destroyed) { clearInterval(poll); return; }
          if (window.YT && window.YT.Player) {
            clearInterval(poll);
            createPlayer();
          }
        }, 100);

        return () => {
          destroyed = true;
          clearInterval(poll);
          try { ytPlayerRef.current?.pauseVideo(); } catch {}
          try { ytPlayerRef.current?.destroy(); } catch {}
          ytPlayerRef.current = null;
        };
      }

      createPlayer();

      return () => {
        destroyed = true;
        // pauseVideo FIRST to kill audio immediately
        try { ytPlayerRef.current?.pauseVideo(); } catch {}
        // Then destroy after a tick so pause has time to apply
        const playerToDestroy = ytPlayerRef.current;
        ytPlayerRef.current = null;
        setTimeout(() => {
          try { playerToDestroy?.destroy(); } catch {}
        }, 50);
      };
    }, [videoId]); // ← recreate on EVERY videoId change

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
