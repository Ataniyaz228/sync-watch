export type VideoType = 'hls' | 'mp4' | 'youtube' | 'iframe';
export type MessageType = 'text' | 'system';

export interface VideoResolution {
  type: VideoType;
  resolvedUrl: string;
  originalUrl: string;
  title?: string;
}

export interface QueueItem {
  id: string;
  type: VideoType;
  resolvedUrl: string;
  originalUrl: string;
  title?: string;
  addedBy: string;
  addedByName: string;
}

export type RequestAction = 'pause' | 'play' | 'seek';

export interface Room {
  id: string;
  slug: string;
  name: string;
  createdBy: string;
  isActive: boolean;
  currentUrl?: string;
  videoType?: VideoType;
  createdAt: string;
  updatedAt: string;
}

export interface WatchHistoryItem {
  id: string;
  url: string;
  resolvedUrl: string;
  videoType: string;
  title?: string;
  createdAt: string;
  addedBy: string;
}

export interface ChatReaction {
  emoji: string;
  userId: string;
  username: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  type: MessageType;
  reactions: ChatReaction[];
  createdAt: string;
  isSystem?: boolean;
}

export interface RoomState {
  currentTime: number;
  isPlaying: boolean;
  url?: string;
  type?: VideoType;
  resolvedUrl?: string;
  title?: string;
  updatedAt: number;
  controlMode?: 'free' | 'cinema';
}

export interface User {
  id: string;
  username: string;
  token: string;
}

export interface ServerToClientEvents {
  'room:user-joined': (data: { userId: string; username: string; usersCount: number; users: string[] }) => void;
  'room:user-left': (data: { userId: string; username: string; usersCount: number }) => void;
  'room:error': (data: { message: string }) => void;
  'room:mode-changed': (data: { mode: 'free' | 'cinema' }) => void;
  'video:play': (data: { currentTime: number; userId: string; executeAt?: number }) => void;
  'video:pause': (data: { currentTime: number; userId: string; executeAt?: number }) => void;
  'video:seek': (data: { currentTime: number; userId: string; executeAt?: number }) => void;
  'video:url-changed': (data: VideoResolution & { userId: string }) => void;
  'video:sync-state': (data: RoomState) => void;
  'video:sync-correction': (data: { currentTime: number; isPlaying: boolean; serverTs: number }) => void;
  'video:heartbeat': (data: { position: number; serverTs: number }) => void;
  'chat:message': (data: ChatMessage) => void;
  'chat:history': (data: ChatMessage[]) => void;
  'chat:reaction': (data: { messageId: string; reaction: ChatReaction; action: 'add' | 'remove' }) => void;
  'video:pause-request': (data: { username: string; currentTime: number }) => void;
  'video:pause-request-rejected': () => void;
  'video:request': (data: { username: string; action: RequestAction; currentTime?: number }) => void;
  'video:request-rejected': (data: { action: RequestAction }) => void;
  'video:url-suggest': (data: { username: string; url: string; title?: string; type: string; resolvedUrl: string; originalUrl: string }) => void;
  'video:url-suggest-rejected': () => void;
  'queue:state': (data: QueueItem[]) => void;
  'queue:added': (data: QueueItem) => void;
  'queue:removed': (data: { id: string }) => void;
  'voice:offer': (data: { sdp: string; from: string }) => void;
  'voice:answer': (data: { sdp: string; from: string }) => void;
  'voice:ice-candidate': (data: { candidate: string; from: string }) => void;
  'voice:user-joined': (data: { userId: string; username: string }) => void;
  'voice:user-left': (data: { userId: string }) => void;
  // Clock sync
  'time:pong': (data: { t1: number; t2: number }) => void;
}

export interface ClientToServerEvents {
  'room:join': (data: { roomSlug: string; username: string; userId: string }) => void;
  'room:leave': (data: { roomSlug: string }) => void;
  'room:set-mode': (data: { roomSlug: string; mode: 'free' | 'cinema' }) => void;
  'video:play': (data: { roomSlug: string; currentTime: number }) => void;
  'video:pause': (data: { roomSlug: string; currentTime: number }) => void;
  'video:seek': (data: { roomSlug: string; currentTime: number }) => void;
  'video:url-change': (data: { roomSlug: string } & VideoResolution) => void;
  'video:sync-request': (data: { roomSlug: string }) => void;
  'video:sync-position': (data: { roomSlug: string; currentTime: number; isPlaying: boolean }) => void;
  'chat:message': (data: { roomSlug: string; content: string }) => void;
  'chat:reaction': (data: { roomSlug: string; messageId: string; emoji: string }) => void;
  'video:pause-request': (data: { roomSlug: string; currentTime: number }) => void;
  'video:pause-request-accept': (data: { roomSlug: string }) => void;
  'video:pause-request-reject': (data: { roomSlug: string }) => void;
  'video:request': (data: { roomSlug: string; action: RequestAction; currentTime?: number }) => void;
  'video:request-accept': (data: { roomSlug: string; action: RequestAction; currentTime?: number }) => void;
  'video:request-reject': (data: { roomSlug: string; action: RequestAction }) => void;
  'video:url-suggest': (data: { roomSlug: string } & VideoResolution) => void;
  'video:url-suggest-accept': (data: { roomSlug: string } & VideoResolution) => void;
  'video:url-suggest-reject': (data: { roomSlug: string }) => void;
  'queue:add': (data: { roomSlug: string } & VideoResolution) => void;
  'queue:remove': (data: { roomSlug: string; id: string }) => void;
  'queue:play-next': (data: { roomSlug: string }) => void;
  'voice:offer': (data: { roomSlug: string; sdp: string; targetUserId: string }) => void;
  'voice:answer': (data: { roomSlug: string; sdp: string; targetUserId: string }) => void;
  'voice:ice-candidate': (data: { roomSlug: string; candidate: string; targetUserId: string }) => void;
  'voice:join': (data: { roomSlug: string }) => void;
  'voice:leave': (data: { roomSlug: string }) => void;
  // Clock sync
  'time:ping': (data: { t1: number; rtt?: number }) => void;
}

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
  namespace YT {
    class Player {
      constructor(element: string | HTMLElement, options: PlayerOptions);
      playVideo(): void;
      pauseVideo(): void;
      seekTo(seconds: number, allowSeekAhead: boolean): void;
      getCurrentTime(): number;
      getPlayerState(): number;
      setPlaybackRate(rate: number): void;
      getAvailablePlaybackRates(): number[];
      destroy(): void;
    }
    interface PlayerOptions {
      height?: string | number;
      width?: string | number;
      videoId?: string;
      playerVars?: Record<string, unknown>;
      events?: {
        onReady?: (event: PlayerEvent) => void;
        onStateChange?: (event: OnStateChangeEvent) => void;
        onError?: (event: PlayerEvent) => void;
      };
    }
    interface PlayerEvent { target: Player; }
    interface OnStateChangeEvent extends PlayerEvent { data: number; }
  }
}

export {};
