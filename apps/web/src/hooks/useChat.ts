'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMessage, ChatReaction, ServerToClientEvents } from '@/types';

interface UseChatOptions {
  on: <E extends keyof ServerToClientEvents>(event: E, handler: ServerToClientEvents[E]) => () => void;
  emit: (event: string, data: unknown) => void;
  roomSlug: string;
}

export function useChat({ on, emit, roomSlug }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = on('chat:message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });
    return unsub;
  }, [on]);

  useEffect(() => {
    const unsub = on('chat:history', (history: ChatMessage[]) => {
      setMessages(history);
    });
    return unsub;
  }, [on]);

  useEffect(() => {
    const unsub = on('chat:reaction', (data: { messageId: string; reaction: ChatReaction; action: 'add' | 'remove' }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== data.messageId) return msg;
          const reactions = [...(msg.reactions || [])];
          if (data.action === 'add') {
            reactions.push(data.reaction);
          } else {
            const idx = reactions.findIndex(r => r.userId === data.reaction.userId && r.emoji === data.reaction.emoji);
            if (idx >= 0) reactions.splice(idx, 1);
          }
          return { ...msg, reactions };
        })
      );
    });
    return unsub;
  }, [on]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    emit('chat:message', { roomSlug, content: content.trim() });
  }, [emit, roomSlug]);

  const reactToMessage = useCallback((messageId: string, emoji: string) => {
    emit('chat:reaction', { roomSlug, messageId, emoji });
  }, [emit, roomSlug]);

  return { messages, sendMessage, reactToMessage, messagesEndRef };
}
