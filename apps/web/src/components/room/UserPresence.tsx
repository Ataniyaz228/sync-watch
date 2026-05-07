'use client';

import { motion } from 'framer-motion';
import { IconUsers } from '@/components/ui/Icons';

interface UserPresenceProps {
  users: string[];
  usersCount: number;
}

export default function UserPresence({ users, usersCount }: UserPresenceProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className="status-dot live" />
        <IconUsers size={13} className="text-[var(--color-text-3)]" />
        <span className="text-xs text-[var(--color-text-3)] font-mono">{usersCount}</span>
      </div>

      {users.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 ml-1">
          {users.slice(0, 4).map((name, i) => (
            <motion.span key={name + i} initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="text-[10px] text-[var(--color-text-3)] px-1.5 py-0.5 rounded surface-raised">
              {name}
            </motion.span>
          ))}
          {users.length > 4 && (
            <span className="text-[10px] text-[var(--color-text-4)] font-mono">+{users.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}
