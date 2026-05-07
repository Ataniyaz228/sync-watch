'use client';

import { forwardRef, useImperativeHandle } from 'react';
import type { VideoPlayerAPI } from '@/hooks/useVideoSync';

interface IframePlayerProps {
  src: string;
}

const IframePlayer = forwardRef<VideoPlayerAPI, IframePlayerProps>(
  ({ src }, ref) => {
    // iframe player has very limited sync capabilities due to cross-origin restrictions
    useImperativeHandle(ref, () => ({
      play: () => { /* Cannot control iframe playback */ },
      pause: () => { /* Cannot control iframe playback */ },
      seek: () => { /* Cannot control iframe playback */ },
      getCurrentTime: () => 0,
      isPlaying: () => false,
    }));

    return (
      <div className="w-full h-full bg-black relative">
        <iframe
          src={src}
          className="w-full h-full border-0"
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-2">
          <p className="text-[10px] text-[var(--color-warning)] opacity-70 uppercase tracking-wider">
            Embed mode — sync limited
          </p>
        </div>
      </div>
    );
  }
);

IframePlayer.displayName = 'IframePlayer';
export default IframePlayer;
