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
    const videoIdRef = useRef(videoId);
    const [isReady, setIsReady] = useState(false);

    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onSeekedRef = useRef(onSeeked);
    const onReadyRef = useRef(onReady);
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
    onSeekedRef.current = onSeeked;
    onReadyRef.current = onReady;
    videoIdRef.current = videoId;

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

    // Create player ONCE on mount, destroy ONCE on unmount
    useEffect(() => {
      let destroyed = false;

      const createPlayer = () => {
        if (destroyed || !containerRef.current) return;

        const playerDiv = document.createElement('div');
        containerRef.current.appendChild(playerDiv);

        ytPlayerRef.current = new YT.Player(playerDiv, {
          videoId: videoIdRef.current,
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
                setIsReady(true);
                onReadyRef.current?.();
              }
            },
            onStateChange: (event: YT.OnStateChangeEvent) => {
              if (destroyed) return;
              const time = ytPlayerRef.current?.getCurrentTime() ?? 0;
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
      };

      if (!window.YT || !window.YT.Player) {
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          tag.async = true;
          document.body.appendChild(tag);
        }
        const poll = setInterval(() => {
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
          if (containerRef.current) containerRef.current.innerHTML = '';
        };
      } else {
        createPlayer();

        return () => {
          destroyed = true;
          try { ytPlayerRef.current?.pauseVideo(); } catch {}
          try { ytPlayerRef.current?.destroy(); } catch {}
          ytPlayerRef.current = null;
          if (containerRef.current) containerRef.current.innerHTML = '';
        };
      }
    }, []); // ← EMPTY DEPS: create once, destroy once

    // When videoId changes, load the new video — NO destroy/recreate
    const loadedIdRef = useRef(videoId); // tracks what's currently loaded
    useEffect(() => {
      if (!isReady || !ytPlayerRef.current) return;
      // Skip if this is the same video we just loaded in the constructor
      if (loadedIdRef.current === videoId) return;
      loadedIdRef.current = videoId;
      try {
        // loadVideoById actually initializes the video track on mobile
        // (cueVideoById only loads thumbnail — audio plays but video stays black)
        (ytPlayerRef.current as unknown as { loadVideoById: (id: string) => void }).loadVideoById(videoId);
        lastTimeRef.current = 0;
      } catch {}
    }, [videoId, isReady]);

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
