'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';
import type { VideoPlayerAPI } from '@/hooks/useVideoSync';

interface HlsPlayerProps {
  src: string;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeeked?: (time: number) => void;
}

const HlsPlayer = forwardRef<VideoPlayerAPI, HlsPlayerProps>(
  ({ src, onPlay, onPause, onSeeked }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

    useImperativeHandle(ref, () => ({
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
      seek: (time: number) => {
        if (videoRef.current) videoRef.current.currentTime = time;
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      isPlaying: () => !videoRef.current?.paused,
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !src) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                break;
            }
          }
        });

        return () => {
          hls.destroy();
          hlsRef.current = null;
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
      }
    }, [src]);

    const handlePlay = useCallback(() => {
      onPlay?.(videoRef.current?.currentTime ?? 0);
    }, [onPlay]);

    const handlePause = useCallback(() => {
      onPause?.(videoRef.current?.currentTime ?? 0);
    }, [onPause]);

    const handleSeeked = useCallback(() => {
      onSeeked?.(videoRef.current?.currentTime ?? 0);
    }, [onSeeked]);

    return (
      <video
        ref={videoRef}
        controls
        playsInline
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        className="w-full h-full object-contain bg-black"
      />
    );
  }
);

HlsPlayer.displayName = 'HlsPlayer';
export default HlsPlayer;
