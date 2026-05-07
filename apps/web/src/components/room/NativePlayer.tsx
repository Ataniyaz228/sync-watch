'use client';

import { useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import type { VideoPlayerAPI } from '@/hooks/useVideoSync';

interface NativePlayerProps {
  src: string;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeeked?: (time: number) => void;
}

const NativePlayer = forwardRef<VideoPlayerAPI, NativePlayerProps>(
  ({ src, onPlay, onPause, onSeeked }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

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
      if (videoRef.current) {
        videoRef.current.src = src;
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

NativePlayer.displayName = 'NativePlayer';
export default NativePlayer;
