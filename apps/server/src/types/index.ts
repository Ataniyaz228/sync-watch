// Shared types between server and client

export interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
}

export type VideoType = 'hls' | 'mp4' | 'youtube' | 'iframe';

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
  addedAt: string;
}

export type MessageType = 'text' | 'system';

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

// Socket.io event payloads

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
  // Pause request from viewer
  'video:pause-request': (data: { username: string; currentTime: number }) => void;
  'video:pause-request-rejected': () => void;
  // Unified viewer request (play/seek)
  'video:request': (data: { username: string; action: RequestAction; currentTime?: number }) => void;
  'video:request-rejected': (data: { action: RequestAction }) => void;
  // Video suggestion from viewer
  'video:url-suggest': (data: { username: string; url: string; title?: string; type: string; resolvedUrl: string; originalUrl: string }) => void;
  'video:url-suggest-rejected': () => void;
  // Queue
  'queue:state': (data: QueueItem[]) => void;
  'queue:added': (data: QueueItem) => void;
  'queue:removed': (data: { id: string }) => void;
  // WebRTC signaling
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
  // Pause request
  'video:pause-request': (data: { roomSlug: string; currentTime: number }) => void;
  'video:pause-request-accept': (data: { roomSlug: string }) => void;
  'video:pause-request-reject': (data: { roomSlug: string }) => void;
  // Unified viewer request (play/seek)
  'video:request': (data: { roomSlug: string; action: RequestAction; currentTime?: number }) => void;
  'video:request-accept': (data: { roomSlug: string; action: RequestAction; currentTime?: number }) => void;
  'video:request-reject': (data: { roomSlug: string; action: RequestAction }) => void;
  // Video suggestion
  'video:url-suggest': (data: { roomSlug: string } & VideoResolution) => void;
  'video:url-suggest-accept': (data: { roomSlug: string } & VideoResolution) => void;
  'video:url-suggest-reject': (data: { roomSlug: string }) => void;
  // Queue
  'queue:add': (data: { roomSlug: string } & VideoResolution) => void;
  'queue:remove': (data: { roomSlug: string; id: string }) => void;
  'queue:play-next': (data: { roomSlug: string }) => void;
  // WebRTC signaling
  'voice:offer': (data: { roomSlug: string; sdp: string; targetUserId: string }) => void;
  'voice:answer': (data: { roomSlug: string; sdp: string; targetUserId: string }) => void;
  'voice:ice-candidate': (data: { roomSlug: string; candidate: string; targetUserId: string }) => void;
  'voice:join': (data: { roomSlug: string }) => void;
  'voice:leave': (data: { roomSlug: string }) => void;
}
