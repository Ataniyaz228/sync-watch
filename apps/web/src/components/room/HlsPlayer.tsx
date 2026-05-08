'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';
import type { VideoPlayerAPI } from '@/hooks/useVideoSync';

interface HlsPlayerProps {
  src: string;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeeked?: (time: number) => void;
  onReady?: () => void;
}

const HlsPlayer = forwardRef<VideoPlayerAPI, HlsPlayerProps>(
  ({ src, onPlay, onPause, onSeeked, onReady }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onSeekedRef = useRef(onSeeked);
    const onReadyRef = useRef(onReady);
    const readyFiredRef = useRef(false);
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

    // HLS source loading — runs on every src change
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !src) return;

      readyFiredRef.current = false;

      const fireReady = () => {
        if (readyFiredRef.current) return;
        readyFiredRef.current = true;
        onReadyRef.current?.();
      };

      // Fallback: if nothing else fires, use loadedmetadata
      const handleMeta = () => fireReady();
      video.addEventListener('loadedmetadata', handleMeta, { once: true });

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          xhrSetup: (xhr) => { xhr.withCredentials = false; },
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hlsRef.current = hls;

        // Primary ready signal for HLS
        hls.on(Hls.Events.MANIFEST_PARSED, () => fireReady());

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
              case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
              default: hls.destroy(); break;
            }
          }
        });

        return () => {
          video.removeEventListener('loadedmetadata', handleMeta);
          hls.destroy();
          hlsRef.current = null;
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // iOS Safari — native HLS
        video.src = src;
        return () => {
          video.removeEventListener('loadedmetadata', handleMeta);
        };
      }
    }, [src]); // ← runs on every src change

    // Event listeners — stable, one-time setup
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
      <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
        <video
          ref={videoRef}
          controls
          playsInline
          webkit-playsinline=""
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    );
  }
);

HlsPlayer.displayName = 'HlsPlayer';
export default HlsPlayer;
