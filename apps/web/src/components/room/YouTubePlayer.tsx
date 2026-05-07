'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import type { VideoPlayerAPI } from '@/hooks/useVideoSync';

interface YouTubePlayerProps {
  videoId: string;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeeked?: (time: number) => void;
}

const YouTubePlayer = forwardRef<VideoPlayerAPI, YouTubePlayerProps>(
  ({ videoId, onPlay, onPause, onSeeked }, ref) => {
    const playerRef = useRef<YT.Player | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);
    const lastTimeRef = useRef(0);

    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      seek: (time: number) => playerRef.current?.seekTo(time, true),
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      isPlaying: () => playerRef.current?.getPlayerState() === 1,
    }));

    const onStateChange = useCallback((event: YT.OnStateChangeEvent) => {
      const time = playerRef.current?.getCurrentTime() ?? 0;

      switch (event.data) {
        case 1: // PLAYING
          onPlay?.(time);
          break;
        case 2: // PAUSED
          onPause?.(time);
          break;
      }

      // Detect seek: if time jumped more than 1 second
      const diff = Math.abs(time - lastTimeRef.current);
      if (diff > 1 && event.data === 1) {
        onSeeked?.(time);
      }
      lastTimeRef.current = time;
    }, [onPlay, onPause, onSeeked]);

    useEffect(() => {
      // Load YouTube IFrame API
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.body.appendChild(tag);
      }

      const initPlayer = () => {
        if (!containerRef.current) return;

        // Clear container
        containerRef.current.innerHTML = '';
        const playerDiv = document.createElement('div');
        playerDiv.id = `yt-player-${videoId}`;
        containerRef.current.appendChild(playerDiv);

        playerRef.current = new YT.Player(playerDiv.id, {
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
            onReady: () => setIsReady(true),
            onStateChange,
          },
        });
      };

      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
      }

      return () => {
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, [videoId, onStateChange]);

    // Track time for seek detection
    useEffect(() => {
      if (!isReady) return;

      const interval = setInterval(() => {
        lastTimeRef.current = playerRef.current?.getCurrentTime() ?? 0;
      }, 500);

      return () => clearInterval(interval);
    }, [isReady]);

    return (
      <div ref={containerRef} className="w-full h-full bg-black" />
    );
  }
);

YouTubePlayer.displayName = 'YouTubePlayer';
export default YouTubePlayer;
