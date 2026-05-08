'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage, ChatReaction } from '@/types';
import { generateAvatarColor, timeAgo, apiRequest } from '@/lib/utils';
import { IconSend, IconSmile, IconX } from '@/components/ui/Icons';

const REACTION_EMOJIS = ['❤️', '😂', '😮', '🔥', '👍', '😢'];

/** Plays a soft "pop" notification using Web Audio API — no files needed */
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
    osc.onended = () => ctx.close();
  } catch {}
}

interface GifResult {
  id: string;
  title: string;
  url: string;
  preview: string;
  dims: number[];
}

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  currentUserId: string;
  // Inline request notifications
  pauseRequest?: { username: string; currentTime: number } | null;
  onAcceptPause?: () => void;
  onRejectPause?: () => void;
  videoRequest?: { username: string; action: string; currentTime?: number } | null;
  onAcceptVideoRequest?: () => void;
  onRejectVideoRequest?: () => void;
  videoSuggestion?: { username: string; url: string; title?: string } | null;
  onAcceptSuggestion?: () => void;
  onRejectSuggestion?: () => void;
}

export default function Chat({ messages, onSendMessage, onReact, messagesEndRef, currentUserId,
  pauseRequest, onAcceptPause, onRejectPause,
  videoRequest, onAcceptVideoRequest, onRejectVideoRequest,
  videoSuggestion, onAcceptSuggestion, onRejectSuggestion,
}: ChatProps) {
  const [input, setInput] = useState('');
  const [activeReactionId, setActiveReactionId] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const gifSearchRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMsgCountRef = useRef(messages.length);

  const fetchGifs = useCallback(async (query: string) => {
    setGifLoading(true);
    try {
      const endpoint = query.trim()
        ? `/api/gifs/search?q=${encodeURIComponent(query)}&limit=20`
        : `/api/gifs/trending?limit=20`;
      const data = await apiRequest<{ results: GifResult[] }>(endpoint);
      setGifResults(data.results || []);
    } catch {
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  // Load trending on open
  useEffect(() => {
    if (showGifPicker) {
      fetchGifs('');
      setTimeout(() => gifSearchRef.current?.focus(), 100);
    } else {
      setGifSearch('');
      setGifResults([]);
    }
  }, [showGifPicker, fetchGifs]);

  // Debounced search
  useEffect(() => {
    if (!showGifPicker) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchGifs(gifSearch);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [gifSearch, showGifPicker, fetchGifs]);

  // Sound notification on new messages from others — only in fullscreen
  useEffect(() => {
    const prev = prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    if (messages.length <= prev) return;
    if (!document.fullscreenElement) return; // only notify in fullscreen
    const newMsgs = messages.slice(prev);
    const hasExternal = newMsgs.some(m => !m.isSystem && m.type !== 'system' && m.userId !== currentUserId);
    if (hasExternal) playNotifSound();
  }, [messages, currentUserId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
    inputRef.current?.focus();
  };

  const sendGif = (url: string) => {
    onSendMessage(url);
    setShowGifPicker(false);
  };

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--chat-bg, var(--color-bg-0))' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
            <IconSmile size={24} className="text-[var(--color-text-4)]" />
            <p className="text-xs text-[var(--color-text-4)]">No messages yet</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }} className="py-0.5">
              {msg.isSystem || msg.type === 'system' ? (
                <div className="flex items-center gap-3 py-1.5 my-1 opacity-70">
                  <div className="h-px bg-gradient-to-r from-transparent to-[var(--color-text-4)]/40 flex-1" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-3)]">{msg.content}</span>
                  <div className="h-px bg-gradient-to-l from-transparent to-[var(--color-text-4)]/40 flex-1" />
                </div>
              ) : (
                <Bubble msg={msg} isOwn={msg.userId === currentUserId} onReact={onReact}
                  activeReactionId={activeReactionId} setActiveReactionId={setActiveReactionId}
                  currentUserId={currentUserId} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* ── Inline Request Cards ── */}
        {pauseRequest && (
          <div className="mx-3 mb-2 p-2.5 rounded-lg" style={{ background: 'var(--dt-ag, rgba(168,184,196,.09))', border: '1px solid var(--dt-ab, rgba(168,184,196,.18))' }}>
            <p style={{ fontSize: 11, color: 'var(--dt-t2, #666)', marginBottom: 6 }}>
              <span style={{ color: 'var(--dt-t1, #eee)', fontWeight: 600 }}>{pauseRequest.username}</span> просит паузу
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={onAcceptPause} className="dt-ep-btn acc" style={{ flex: 1, justifyContent: 'center', padding: '4px 0', fontSize: 10 }}>ок</button>
              <button onClick={onRejectPause} className="dt-ep-btn" style={{ flex: 1, justifyContent: 'center', padding: '4px 0', fontSize: 10 }}>нет</button>
            </div>
          </div>
        )}
        {videoRequest && (
          <div className="mx-3 mb-2 p-2.5 rounded-lg" style={{ background: 'var(--dt-ag, rgba(168,184,196,.09))', border: '1px solid var(--dt-ab, rgba(168,184,196,.18))' }}>
            <p style={{ fontSize: 11, color: 'var(--dt-t2, #666)', marginBottom: 6 }}>
              <span style={{ color: 'var(--dt-t1, #eee)', fontWeight: 600 }}>{videoRequest.username}</span>
              {' '}просит {videoRequest.action === 'play' ? 'play' : `seek → ${Math.floor((videoRequest.currentTime || 0) / 60)}:${String(Math.floor((videoRequest.currentTime || 0) % 60)).padStart(2, '0')}`}
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={onAcceptVideoRequest} className="dt-ep-btn acc" style={{ flex: 1, justifyContent: 'center', padding: '4px 0', fontSize: 10 }}>ок</button>
              <button onClick={onRejectVideoRequest} className="dt-ep-btn" style={{ flex: 1, justifyContent: 'center', padding: '4px 0', fontSize: 10 }}>нет</button>
            </div>
          </div>
        )}
        {videoSuggestion && (
          <div className="mx-3 mb-2 p-2.5 rounded-lg" style={{ background: 'var(--dt-ag, rgba(168,184,196,.09))', border: '1px solid var(--dt-ab, rgba(168,184,196,.18))' }}>
            <p style={{ fontSize: 11, color: 'var(--dt-t2, #666)', marginBottom: 2 }}>
              <span style={{ color: 'var(--dt-t1, #eee)', fontWeight: 600 }}>{videoSuggestion.username}</span> предлагает видео
            </p>
            <p style={{ fontSize: 10, color: 'var(--dt-a, #A8B8C4)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {videoSuggestion.title || videoSuggestion.url}
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={onAcceptSuggestion} className="dt-ep-btn acc" style={{ flex: 1, justifyContent: 'center', padding: '4px 0', fontSize: 10 }}>принять</button>
              <button onClick={onRejectSuggestion} className="dt-ep-btn" style={{ flex: 1, justifyContent: 'center', padding: '4px 0', fontSize: 10 }}>нет</button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* GIF Picker */}
      <AnimatePresence>
        {showGifPicker && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[var(--color-bg-1)] border-t border-[var(--color-border)] z-30 flex flex-col shrink-0 overflow-hidden shadow-[0_-10px_30px_rgba(0,0,0,0.1)] relative">
            
            <div className="flex flex-col h-[320px] max-h-[40vh]">
              {/* Search Header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)]">
                <div className="flex-1 relative">
                  <input
                    ref={gifSearchRef}
                    type="text"
                    value={gifSearch}
                    onChange={(e) => setGifSearch(e.target.value)}
                    placeholder="Search GIFs..."
                    autoComplete="off"
                    className="w-full bg-[var(--color-bg-0)] border border-[var(--color-border)] focus:border-[var(--chat-accent,#A8B8C4)]/50 rounded-xl py-3 pl-4 pr-9 text-[14px] text-[var(--color-text-0)] placeholder:text-[var(--color-text-4)] transition-all outline-none"
                  />
                  {gifLoading && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--chat-accent,#A8B8C4)', borderTopColor: 'transparent' }} />
                    </div>
                  )}
                </div>
                <button onClick={() => setShowGifPicker(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-4)] hover:text-[var(--color-text-0)] hover:bg-[var(--color-bg-3)] transition-all shrink-0">
                  <IconX size={16} />
                </button>
              </div>

              {/* GIF Grid */}
              <div className="flex-1 overflow-y-auto p-2 min-h-0">
                {gifLoading ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="skeleton aspect-square rounded-lg" />
                    ))}
                  </div>
                ) : gifResults.length > 0 ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {gifResults.map((gif) => (
                      <button key={gif.id} onClick={() => sendGif(gif.url)}
                        className="rounded-lg overflow-hidden bg-[var(--color-bg-3)] border border-transparent hover:border-[var(--chat-accent,#A8B8C4)]/60 transition-all group aspect-square">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={gif.preview || gif.url} alt={gif.title} loading="lazy"
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--color-text-4)] text-xs">
                    {gifSearch ? 'No GIFs found' : 'Search for GIFs'}
                  </div>
                )}
              </div>

              {/* Tenor Attribution */}
              <div className="px-3 py-1.5 text-center border-t border-[var(--color-border)]">
                <span className="text-[9px] text-[var(--color-text-4)] uppercase tracking-wider font-medium">Powered by GIPHY</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <form onSubmit={handleSubmit} className="chat-form px-3 py-3.5 border-t border-[var(--color-border)] flex-shrink-0 safe-bottom relative z-40" style={{ background: 'var(--chat-input-bg, var(--color-bg-1))' }}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowGifPicker(!showGifPicker)}
            className="chat-gif-btn w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0"
            style={{
              background: showGifPicker ? 'var(--chat-accent,#A8B8C4)' : 'var(--color-bg-3)',
              color: showGifPicker ? '#000' : 'var(--color-text-3)',
            }} title="GIFs">
            <span className="text-[10px] font-black uppercase tracking-tight">GIF</span>
          </button>
          <div className="flex-1 relative">
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..." autoComplete="off"
              className="chat-msg-input w-full border border-[var(--color-border)] rounded-xl py-3 px-4 text-[14px] text-[var(--color-text-0)] placeholder:text-[var(--color-text-4)] transition-all outline-none"
              style={{ background: 'var(--chat-input-field, var(--color-bg-2))' }}
              maxLength={500} id="chat-input" />
          </div>
          <button type="submit" disabled={!input.trim()}
            className="chat-send-btn w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0"
            style={{
              background: input.trim() ? 'var(--chat-accent,#A8B8C4)' : 'var(--color-bg-3)',
              color: input.trim() ? '#000' : 'var(--color-text-4)',
            }}
            id="chat-send-btn">
            <IconSend size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}

function isGifUrl(content: string): boolean {
  if (/^https?:\/\/.*\.gif(\?.*)?$/i.test(content)) return true;
  if (content.includes('media.giphy.com') || content.includes('tenor.googleapis.com') || content.includes('media.tenor.com')) return true;
  return false;
}

function Bubble({ msg, isOwn, onReact, activeReactionId, setActiveReactionId, currentUserId }: {
  msg: ChatMessage; isOwn: boolean;
  onReact: (id: string, emoji: string) => void;
  activeReactionId: string | null;
  setActiveReactionId: (id: string | null) => void;
  currentUserId: string;
}) {
  const color = generateAvatarColor(msg.username);
  const showPicker = activeReactionId === msg.id;
  const togglePicker = () => setActiveReactionId(showPicker ? null : msg.id);
  const react = (emoji: string) => { onReact(msg.id, emoji); setActiveReactionId(null); };

  const groups = (msg.reactions || []).reduce((a, r) => {
    if (!a[r.emoji]) a[r.emoji] = [];
    a[r.emoji].push(r);
    return a;
  }, {} as Record<string, ChatReaction[]>);

  const isGif = isGifUrl(msg.content);

  return (
    <div className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : ''} group mb-1`}>
      <div className="w-7 h-7 rounded-[10px] shadow-sm flex-shrink-0 flex items-center justify-center text-[11px] font-black text-[var(--color-bg-0)] mt-0.5"
        style={{ backgroundColor: color }}>
        {msg.username[0].toUpperCase()}
      </div>
      <div className={`max-w-[85%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-baseline gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="text-[11px] font-bold tracking-tight" style={{ color }}>{msg.username}</span>
          <span className="text-[9px] text-[var(--color-text-4)] font-medium tracking-wide">{timeAgo(msg.createdAt)}</span>
        </div>
        <div className={`chat-bubble cursor-pointer transition-all overflow-hidden shadow-sm ${
          isGif ? 'bg-transparent rounded-[14px]' : (isOwn
            ? 'chat-bubble-own rounded-[16px] rounded-tr-[4px]'
            : 'rounded-[16px] rounded-tl-[4px]')
        }`}
          style={isOwn && !isGif ? {
            background: 'var(--chat-own-bg, rgba(168,184,196,0.12))',
            border: '1px solid var(--chat-own-border, rgba(168,184,196,0.25))',
            color: 'var(--color-text-0)'
          } : (!isGif ? { 
            background: 'var(--color-bg-2)',
            border: '1px solid rgba(255,255,255,0.04)'
          } : undefined)}
          onClick={togglePicker}>
          {isGif ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={msg.content} alt="GIF" className="max-w-[240px] w-full rounded-[14px] border border-white/10 shadow-md" />
          ) : (
            <div className="px-3.5 py-2 text-[13.5px] leading-relaxed text-[var(--color-text-1)] break-words">{msg.content}</div>
          )}
        </div>

        {Object.keys(groups).length > 0 && (
          <div className="reaction-bar mt-1">
            {Object.entries(groups).map(([emoji, users]) => (
              <button key={emoji} onClick={() => react(emoji)}
                className={`reaction-pill ${users.some(u => u.userId === currentUserId) ? 'own' : ''}`}>
                <span>{emoji}</span>
                {users.length > 1 && <span className="count">{users.length}</span>}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence>
          {showPicker && (
            <motion.div initial={{ opacity: 0, y: 4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }} transition={{ duration: 0.12 }}
              className="reaction-picker mt-1">
              {REACTION_EMOJIS.map((e) => <button key={e} onClick={() => react(e)} className="!w-[40px] !h-[40px] sm:!w-[32px] sm:!h-[32px] text-[20px] sm:text-[18px]">{e}</button>)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
