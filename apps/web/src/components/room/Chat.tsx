'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage, ChatReaction } from '@/types';
import { generateAvatarColor, timeAgo } from '@/lib/utils';
import { IconSend, IconSmile, IconPlus } from '@/components/ui/Icons';

const REACTION_EMOJIS = ['❤️', '😂', '😮', '🔥', '👍', '😢'];

const CURATED_GIFS = [
  'https://media.tenor.com/2cehC2w2YToAAAAM/popcorn-eating.gif',
  'https://media.tenor.com/Z1B84N76k0QAAAAM/laughing-meme.gif',
  'https://media.tenor.com/Y3B1GXXr2WMAAAAM/mind-blown-explosion.gif',
  'https://media.tenor.com/1GvKk_Y8hU0AAAAM/sad-crying.gif',
  'https://media.tenor.com/5Oq595c51R8AAAAM/shocked-surprised.gif',
  'https://media.tenor.com/1_8w02q3gMAAAAAM/yes-nod.gif',
  'https://media.tenor.com/00lO0k94ZkQAAAAM/no-nope.gif',
  'https://media.tenor.com/x8v1oNUOmg4AAAAM/rickroll-roll.gif',
  'https://media.tenor.com/bL6tI4p1b_IAAAAM/facepalm-picard.gif',
  'https://media.tenor.com/3Zib4pXh6vAAAAAM/dancing-cat.gif',
  'https://media.tenor.com/B9B1z2kH4A4AAAAM/this-is-fine-fire.gif',
  'https://media.tenor.com/m2i2vS4UfE8AAAAM/sus-rock.gif'
];

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  currentUserId: string;
}

export default function Chat({ messages, onSendMessage, onReact, messagesEndRef, currentUserId }: ChatProps) {
  const [input, setInput] = useState('');
  const [activeReactionId, setActiveReactionId] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex flex-col h-full bg-[var(--color-bg-0)] relative">
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
                <div className="flex items-center gap-3 py-2 my-1 opacity-80">
                  <div className="h-px bg-gradient-to-r from-transparent to-[#D4A06A]/30 flex-1" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4A06A]">{msg.content}</span>
                  <div className="h-px bg-gradient-to-l from-transparent to-[#D4A06A]/30 flex-1" />
                </div>
              ) : (
                <Bubble msg={msg} isOwn={msg.userId === currentUserId} onReact={onReact}
                  activeReactionId={activeReactionId} setActiveReactionId={setActiveReactionId}
                  currentUserId={currentUserId} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* GIF Picker Popover */}
      <AnimatePresence>
        {showGifPicker && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 z-10" onClick={() => setShowGifPicker(false)} />
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-[70px] left-3 right-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] rounded-2xl p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20 h-[240px] flex flex-col">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-[var(--color-text-0)] uppercase tracking-wider">Select GIF</span>
              </div>
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-3 gap-2">
                  {CURATED_GIFS.map((url, i) => (
                    <button key={i} onClick={() => sendGif(url)} className="relative aspect-square rounded-xl overflow-hidden bg-[var(--color-bg-3)] group border border-transparent hover:border-[#D4A06A] transition-all">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="GIF" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 py-3 border-t border-[var(--color-border)] flex-shrink-0 safe-bottom bg-[var(--color-bg-1)] relative z-20">
        <div className="relative flex items-center">
          <button type="button" onClick={() => setShowGifPicker(!showGifPicker)}
            className={`absolute left-1.5 w-8 h-8 rounded-full flex items-center justify-center transition-all ${showGifPicker ? 'bg-[#D4A06A]/20 text-[#D4A06A]' : 'text-[var(--color-text-4)] hover:text-[var(--color-text-1)]'}`} title="GIFs">
            <span className="text-[9px] font-black uppercase tracking-tighter">GIF</span>
          </button>
          <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..." className="w-full bg-[var(--color-bg-0)] border border-[var(--color-border)] focus:border-[#D4A06A]/50 focus:shadow-[0_0_15px_rgba(212,160,106,0.1)] rounded-full py-2.5 pl-[42px] pr-12 text-[13px] text-[var(--color-text-0)] placeholder:text-[var(--color-text-4)] transition-all outline-none" maxLength={500} id="chat-input" />
          <button type="submit" disabled={!input.trim()} className={`absolute right-1.5 w-8 h-8 rounded-full flex items-center justify-center transition-all ${input.trim() ? 'bg-[#D4A06A] text-black shadow-[0_0_10px_rgba(212,160,106,0.4)] hover:scale-105' : 'bg-[var(--color-bg-3)] text-[var(--color-text-4)]'}`} id="chat-send-btn">
            <IconSend size={13} className={input.trim() ? 'translate-x-[-1px]' : ''} />
          </button>
        </div>
      </form>
    </div>
  );
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

  const isGif = msg.content.startsWith('https://') && msg.content.endsWith('.gif');

  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''} group`}>
      <div className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[var(--color-bg-0)] mt-0.5"
        style={{ backgroundColor: color }}>
        {msg.username[0].toUpperCase()}
      </div>
      <div className={`max-w-[80%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-baseline gap-1.5 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] font-medium" style={{ color }}>{msg.username}</span>
          <span className="text-[9px] text-[var(--color-text-4)] font-mono">{timeAgo(msg.createdAt)}</span>
        </div>
        <div className={`rounded-lg cursor-pointer transition-colors overflow-hidden ${
          isOwn ? (isGif ? 'bg-transparent' : 'bg-[var(--color-bg-3)] hover:bg-[var(--color-bg-4)]') 
                : (isGif ? 'bg-transparent' : 'bg-[var(--color-bg-2)] hover:bg-[var(--color-bg-3)]')
        }`} onClick={togglePicker}>
          {isGif ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={msg.content} alt="GIF" className="max-w-[200px] w-full object-cover rounded-xl border border-white/5" />
          ) : (
            <div className="px-3 py-1.5 text-sm leading-relaxed text-[var(--color-text-1)] break-words">{msg.content}</div>
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
              {REACTION_EMOJIS.map((e) => <button key={e} onClick={() => react(e)}>{e}</button>)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
