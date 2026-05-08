'use client';

import { useRef, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import type { VideoPlayerAPI } from '@/hooks/useVideoSync';

interface NativePlayerProps {
  src: string;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeeked?: (time: number) => void;
  onReady?: () => void;
}

const NativePlayer = forwardRef<VideoPlayerAPI, NativePlayerProps>(
  ({ src, onPlay, onPause, onSeeked, onReady }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onSeekedRef = useRef(onSeeked);
    const onReadyRef = useRef(onReady);
    const [debugInfo, setDebugInfo] = useState('loading...');
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
    onSeekedRef.current = onSeeked;
    onReadyRef.current = onReady;

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

      const logEvent = (name: string) => () => {
        const info = `${name} | ${v.videoWidth}x${v.videoHeight} | ready=${v.readyState}`;
        console.log('[MP4]', info);
        setDebugInfo(info);
      };

      v.addEventListener('loadstart', logEvent('loadstart'));
      v.addEventListener('loadedmetadata', logEvent('loadedmeta'));
      v.addEventListener('loadeddata', logEvent('loadeddata'));
      v.addEventListener('canplay', logEvent('canplay'));
      v.addEventListener('playing', logEvent('playing'));

      v.addEventListener('loadedmetadata', () => {
        if (v.videoWidth === 0) {
          setDebugInfo('NO VIDEO TRACK (audio-only)');
          console.warn('[MP4] videoWidth=0 — audio-only file!');
        }
        onReadyRef.current?.();
      }, { once: true });

      v.addEventListener('error', () => {
        const info = `ERROR: code=${v.error?.code} msg=${v.error?.message}`;
        console.error('[MP4]', info);
        setDebugInfo(info);
      });

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
      <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          webkit-playsinline=""
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
        {/* Debug overlay */}
        <div style={{
          position: 'absolute', bottom: 4, left: 4, right: 4,
          background: 'rgba(0,0,0,0.8)', color: '#0f0', fontSize: 9,
          padding: '2px 6px', borderRadius: 4, pointerEvents: 'none',
          fontFamily: 'monospace', zIndex: 20,
        }}>
          MP4: {debugInfo}
        </div>
      </div>
    );
  }
);

NativePlayer.displayName = 'NativePlayer';
export default NativePlayer;
