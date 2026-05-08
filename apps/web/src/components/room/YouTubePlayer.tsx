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
          return s === 1 || s === 3;
        } catch { return false; }
      },
    }));

    useEffect(() => {
      let destroyed = false;
      let playerInstance: YT.Player | null = null;

      // Properly destroy a YT player — stop audio FIRST, then destroy
      const destroyPlayer = () => {
        if (!playerInstance) return;
        try {
          // Stop audio immediately before destroying
          playerInstance.pauseVideo();
          playerInstance.destroy();
        } catch {
          // If destroy fails, forcefully remove the iframe from DOM
          try {
            const iframe = (playerInstance as unknown as { getIframe?: () => HTMLIFrameElement }).getIframe?.();
            iframe?.remove();
          } catch {}
        }
        playerInstance = null;
        ytPlayerRef.current = null;
      };

      const createPlayer = () => {
        if (destroyed || !containerRef.current) return;

        // Destroy existing player BEFORE creating new one
        destroyPlayer();

        const playerDiv = document.createElement('div');
        containerRef.current.appendChild(playerDiv);

        playerInstance = new YT.Player(playerDiv, {
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
              const time = playerInstance?.getCurrentTime() ?? 0;
              switch (event.data) {
                case 1: onPlayRef.current?.(time); break;
                case 2: onPauseRef.current?.(time); break;
              }
              const drift = Math.abs(time - lastTimeRef.current);
              if (drift > 1 && event.data === 1) {
                onSeekedRef.current?.(time);
              }
              lastTimeRef.current = time;
            },
          },
        });
        ytPlayerRef.current = playerInstance;
      };

      if (!window.YT || !window.YT.Player) {
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          tag.async = true;
          document.body.appendChild(tag);
        }
        // Use a polling approach instead of callback chaining to avoid leaks
        const checkReady = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(checkReady);
            createPlayer();
          }
        }, 100);

        return () => {
          destroyed = true;
          clearInterval(checkReady);
          setReadyFlag(false);
          destroyPlayer();
          // Clear container to remove any orphaned iframes
          if (containerRef.current) containerRef.current.innerHTML = '';
        };
      } else {
        createPlayer();

        return () => {
          destroyed = true;
          setReadyFlag(false);
          destroyPlayer();
          if (containerRef.current) containerRef.current.innerHTML = '';
        };
      }
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
