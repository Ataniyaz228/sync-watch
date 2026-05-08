'use client';

import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import type { VideoPlayerAPI } from '@/hooks/useVideoSync';

interface IframePlayerProps {
  src: string;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeeked?: (time: number) => void;
}

// Detect if this is a VK embed — supports postMessage API
function isVkEmbed(src: string) {
  return src.includes('vk.com/video_ext');
}

const IframePlayer = forwardRef<VideoPlayerAPI, IframePlayerProps>(
  ({ src, onPlay, onPause, onSeeked }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const currentTimeRef = useRef(0);
    const isPlayingRef = useRef(false);
    const durationRef = useRef(0);
    const [isVk] = useState(() => isVkEmbed(src));
    const isVkReadyRef = useRef(false);
    const pendingCmdsRef = useRef<Array<{ method: string; params?: unknown[] }>>([]);

    // Send postMessage to VK player
    const vkSend = (method: string, params?: unknown[]) => {
      if (!iframeRef.current?.contentWindow) return;
      if (!isVkReadyRef.current) {
        // Buffer command until player is ready
        pendingCmdsRef.current.push({ method, params });
        return;
      }
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ method, params }),
        '*'
      );
    };

    // Flush buffered commands
    const flushPending = () => {
      const cmds = pendingCmdsRef.current.splice(0);
      for (const cmd of cmds) {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ method: cmd.method, params: cmd.params }),
            '*'
          );
        }
      }
    };

    // Listen for messages from VK player
    useEffect(() => {
      if (!isVk) return;

      const handler = (e: MessageEvent) => {
        if (!iframeRef.current) return;
        if (e.source !== iframeRef.current.contentWindow) return;

        let data: Record<string, unknown>;
        try {
          data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        } catch {
          return;
        }

        const { type, params } = data as { type?: string; params?: number[] };

        switch (type) {
          case 'inited':
            isVkReadyRef.current = true;
            vkSend('subscribe', ['timeUpdate', 'play', 'pause', 'ended']);
            // Flush any pending seek/play commands
            setTimeout(flushPending, 100);
            break;
          case 'timeUpdate':
            if (params?.[0] !== undefined) currentTimeRef.current = params[0];
            if (params?.[1] !== undefined) durationRef.current = params[1];
            break;
          case 'play':
            isPlayingRef.current = true;
            onPlay?.(currentTimeRef.current);
            break;
          case 'pause':
            isPlayingRef.current = false;
            onPause?.(currentTimeRef.current);
            break;
          case 'seek':
            if (params?.[0] !== undefined) {
              currentTimeRef.current = params[0];
              onSeeked?.(params[0]);
            }
            break;
        }
      };

      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, [isVk, onPlay, onPause, onSeeked]);

    useImperativeHandle(ref, () => ({
      play: () => {
        if (isVk) vkSend('play');
      },
      pause: () => {
        if (isVk) vkSend('pause');
      },
      seek: (time: number) => {
        if (isVk) {
          vkSend('seek', [time]);
          currentTimeRef.current = time;
        }
      },
      getCurrentTime: () => currentTimeRef.current,
      isPlaying: () => isPlayingRef.current,
      getDuration: () => durationRef.current,
    }));

    return (
      <div className="w-full h-full bg-black relative">
        <iframe
          ref={iframeRef}
          src={src}
          className="w-full h-full border-0"
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        />
        {!isVk && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-2">
            <p className="text-[10px] text-[var(--color-warning)] opacity-70 uppercase tracking-wider">
              Embed mode — sync limited
            </p>
          </div>
        )}
      </div>
    );
  }
);

IframePlayer.displayName = 'IframePlayer';
export default IframePlayer;
