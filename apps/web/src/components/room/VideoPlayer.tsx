'use client';

import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HlsPlayer from './HlsPlayer';
import YouTubePlayer from './YouTubePlayer';
import NativePlayer from './NativePlayer';
import IframePlayer from './IframePlayer';
import type { VideoType } from '@/types';
import type { VideoPlayerAPI } from '@/hooks/useVideoSync';
import { IconPlay } from '@/components/ui/Icons';

interface VideoPlayerProps {
  type: VideoType | null;
  url: string;
  title?: string;
  onPlay: (time: number) => void;
  onPause: (time: number) => void;
  onSeeked: (time: number) => void;
  playerRef: React.MutableRefObject<VideoPlayerAPI | null>;
}

export default function VideoPlayer({ type, url, title, onPlay, onPause, onSeeked, playerRef }: VideoPlayerProps) {
  const internalRef = useRef<VideoPlayerAPI>(null);

  const setRef = useCallback((api: VideoPlayerAPI | null) => {
    (internalRef as React.MutableRefObject<VideoPlayerAPI | null>).current = api;
    playerRef.current = api;
  }, [playerRef]);

  if (!type || !url) {
    return (
      <div className="video-container">
        <div className="flex flex-col items-center justify-center gap-3 text-center p-8">
          <div className="w-14 h-14 rounded-xl surface-raised flex items-center justify-center">
            <IconPlay size={24} className="text-[var(--color-text-4)]" />
          </div>
          <div>
            <p className="text-[var(--color-text-2)] text-sm font-medium">No video loaded</p>
            <p className="text-[var(--color-text-4)] text-xs mt-0.5">Paste a URL below to start</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {title && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-4 py-2.5 rounded-t-[10px]">
          <p className="text-xs text-white/80 font-medium truncate">{title}</p>
        </div>
      )}
      <div className="video-container">
        <AnimatePresence mode="wait">
          <motion.div key={`${type}-${url}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }} className="absolute inset-0">
            {type === 'hls' && <HlsPlayer ref={setRef} src={url} onPlay={onPlay} onPause={onPause} onSeeked={onSeeked} />}
            {type === 'youtube' && <YouTubePlayer ref={setRef} videoId={url} onPlay={onPlay} onPause={onPause} onSeeked={onSeeked} />}
            {type === 'mp4' && <NativePlayer ref={setRef} src={url} onPlay={onPlay} onPause={onPause} onSeeked={onSeeked} />}
            {type === 'iframe' && <IframePlayer ref={setRef} src={url} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
