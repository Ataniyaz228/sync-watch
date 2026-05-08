'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
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
      const video = videoRef.current;
      if (!video || !src) return;

      // Debug: log all video events
      const logEvent = (name: string) => () => {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const info = `${name} | ${w}x${h} | readyState=${video.readyState}`;
        console.log('[HLS]', info);
        setDebugInfo(info);
      };

      video.addEventListener('loadstart', logEvent('loadstart'));
      video.addEventListener('loadedmetadata', logEvent('loadedmetadata'));
      video.addEventListener('loadeddata', logEvent('loadeddata'));
      video.addEventListener('canplay', logEvent('canplay'));
      video.addEventListener('playing', logEvent('playing'));
      video.addEventListener('error', () => {
        const err = video.error;
        const info = `ERROR: code=${err?.code} msg=${err?.message}`;
        console.error('[HLS]', info);
        setDebugInfo(info);
      });

      // Check video dimensions after metadata loads
      video.addEventListener('loadedmetadata', () => {
        if (video.videoWidth === 0) {
          console.warn('[HLS] videoWidth=0 — NO VIDEO TRACK in stream!');
          setDebugInfo('NO VIDEO TRACK (audio-only stream)');
        }
        onReadyRef.current?.();
      }, { once: true });

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          xhrSetup: (xhr) => { xhr.withCredentials = false; },
        });

        hls.loadSource(src);
        hls.attachMedia(video);
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          console.log('[HLS] Manifest parsed:', {
            levels: data.levels.length,
            audioTracks: hls.audioTracks.length,
            firstLevel: data.levels[0] ? {
              width: data.levels[0].width,
              height: data.levels[0].height,
              codec: data.levels[0].codecSet,
              videoCodec: data.levels[0].videoCodec,
              audioCodec: data.levels[0].audioCodec,
            } : 'none',
          });
          setDebugInfo(`${data.levels.length} levels, ${data.levels[0]?.width}x${data.levels[0]?.height}`);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.error('[HLS] Error:', data.type, data.details, data.fatal);
          if (data.fatal) {
            setDebugInfo(`FATAL: ${data.details}`);
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
        // iOS Safari — native HLS
        video.src = src;
        return;
      }
    }, [src]);

    // Stable event listeners via refs
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
        {/* Debug overlay — remove after fixing */}
        <div style={{
          position: 'absolute', bottom: 4, left: 4, right: 4,
          background: 'rgba(0,0,0,0.8)', color: '#0f0', fontSize: 9,
          padding: '2px 6px', borderRadius: 4, pointerEvents: 'none',
          fontFamily: 'monospace', zIndex: 20,
        }}>
          HLS: {debugInfo}
        </div>
      </div>
    );
  }
);

HlsPlayer.displayName = 'HlsPlayer';
export default HlsPlayer;
