export type VideoType = 'hls' | 'mp4' | 'youtube' | 'iframe';
export type MessageType = 'text' | 'system';

export interface VideoResolution {
  type: VideoType;
  resolvedUrl: string;
  originalUrl: string;
  title?: string;
}

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
  'video:play': (data: { currentTime: number; userId: string }) => void;
  'video:pause': (data: { currentTime: number; userId: string }) => void;
  'video:seek': (data: { currentTime: number; userId: string }) => void;
  'video:url-changed': (data: VideoResolution & { userId: string }) => void;
  'video:sync-state': (data: RoomState) => void;
  'chat:message': (data: ChatMessage) => void;
  'chat:history': (data: ChatMessage[]) => void;
  'chat:reaction': (data: { messageId: string; reaction: ChatReaction; action: 'add' | 'remove' }) => void;
  'video:pause-request': (data: { username: string; currentTime: number }) => void;
  'video:pause-request-rejected': () => void;
  'voice:offer': (data: { sdp: string; from: string }) => void;
  'voice:answer': (data: { sdp: string; from: string }) => void;
  'voice:ice-candidate': (data: { candidate: string; from: string }) => void;
  'voice:user-joined': (data: { userId: string; username: string }) => void;
  'voice:user-left': (data: { userId: string }) => void;
}

export interface ClientToServerEvents {
  'room:join': (data: { roomSlug: string; username: string; userId: string }) => void;
  'room:leave': (data: { roomSlug: string }) => void;
  'video:play': (data: { roomSlug: string; currentTime: number }) => void;
  'video:pause': (data: { roomSlug: string; currentTime: number }) => void;
  'video:seek': (data: { roomSlug: string; currentTime: number }) => void;
  'video:url-change': (data: { roomSlug: string } & VideoResolution) => void;
  'video:sync-request': (data: { roomSlug: string }) => void;
  'chat:message': (data: { roomSlug: string; content: string }) => void;
  'chat:reaction': (data: { roomSlug: string; messageId: string; emoji: string }) => void;
  'video:pause-request': (data: { roomSlug: string; currentTime: number }) => void;
  'video:pause-request-accept': (data: { roomSlug: string }) => void;
  'video:pause-request-reject': (data: { roomSlug: string }) => void;
  'voice:offer': (data: { roomSlug: string; sdp: string; targetUserId: string }) => void;
  'voice:answer': (data: { roomSlug: string; sdp: string; targetUserId: string }) => void;
  'voice:ice-candidate': (data: { roomSlug: string; candidate: string; targetUserId: string }) => void;
  'voice:join': (data: { roomSlug: string }) => void;
  'voice:leave': (data: { roomSlug: string }) => void;
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
