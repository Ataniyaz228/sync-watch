'use client';

import { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
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
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onSeekedRef = useRef(onSeeked);
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
    onSeekedRef.current = onSeeked;

    useImperativeHandle(ref, () => ({
      play: () => { videoRef.current?.play().catch(() => {}); },
      pause: () => videoRef.current?.pause(),
      seek: (time: number) => {
        if (videoRef.current) videoRef.current.currentTime = time;
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      isPlaying: () => !!videoRef.current && !videoRef.current.paused,
    }));

    useEffect(() => {
      const v = videoRef.current;
      if (!v) return;

      const handlePlay = () => onPlayRef.current?.(v.currentTime);
      const handlePause = () => onPauseRef.current?.(v.currentTime);
      const handleSeeked = () => onSeekedRef.current?.(v.currentTime);

      v.addEventListener('play', handlePlay);
      v.addEventListener('pause', handlePause);
      v.addEventListener('seeked', handleSeeked);

      return () => {
        v.removeEventListener('play', handlePlay);
        v.removeEventListener('pause', handlePause);
        v.removeEventListener('seeked', handleSeeked);
      };
    }, []);

    return (
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        crossOrigin="anonymous"
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
      />
    );
  }
);

NativePlayer.displayName = 'NativePlayer';
export default NativePlayer;
