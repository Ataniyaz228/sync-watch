'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import type { VideoPlayerAPI } from '@/hooks/useVideoSync';

interface YouTubePlayerProps {
  videoId: string;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeeked?: (time: number) => void;
}

const YouTubePlayer = forwardRef<VideoPlayerAPI, YouTubePlayerProps>(
  ({ videoId, onPlay, onPause, onSeeked }, ref) => {
    const ytPlayerRef = useRef<YT.Player | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);
    const lastTimeRef = useRef(0);

    // Store callbacks in refs so we don't need them in dependencies
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onSeekedRef = useRef(onSeeked);
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
    onSeekedRef.current = onSeeked;

    useImperativeHandle(ref, () => ({
      play: () => ytPlayerRef.current?.playVideo(),
      pause: () => ytPlayerRef.current?.pauseVideo(),
      seek: (time: number) => ytPlayerRef.current?.seekTo(time, true),
      getCurrentTime: () => ytPlayerRef.current?.getCurrentTime() ?? 0,
      isPlaying: () => ytPlayerRef.current?.getPlayerState() === 1,
    }));

    // Initialize YouTube player — only depends on videoId
    useEffect(() => {
      let destroyed = false;

      const createPlayer = () => {
        if (destroyed || !containerRef.current) return;

        // Clear container
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
              if (!destroyed) setIsReady(true);
            },
            onStateChange: (event: YT.OnStateChangeEvent) => {
              const time = ytPlayerRef.current?.getCurrentTime() ?? 0;
              switch (event.data) {
                case 1: // PLAYING
                  onPlayRef.current?.(time);
                  break;
                case 2: // PAUSED
                  onPauseRef.current?.(time);
                  break;
              }
              // Detect seek: time jumped > 1s while playing
              const drift = Math.abs(time - lastTimeRef.current);
              if (drift > 1 && event.data === 1) {
                onSeekedRef.current?.(time);
              }
              lastTimeRef.current = time;
            },
          },
        });
      };

      // Load YT API if needed
      if (!window.YT || !window.YT.Player) {
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          tag.async = true;
          document.body.appendChild(tag);
        }
        // Wait for API
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
        setIsReady(false);
        try { ytPlayerRef.current?.destroy(); } catch { /* ignore */ }
        ytPlayerRef.current = null;
      };
    }, [videoId]); // ONLY videoId — no callback dependencies!

    // Track time for seek detection
    useEffect(() => {
      if (!isReady) return;
      const interval = setInterval(() => {
        lastTimeRef.current = ytPlayerRef.current?.getCurrentTime() ?? 0;
      }, 500);
      return () => clearInterval(interval);
    }, [isReady]);

    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#000' }} />
    );
  }
);

YouTubePlayer.displayName = 'YouTubePlayer';
export default YouTubePlayer;
