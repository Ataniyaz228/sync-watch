'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import RoomView from '@/components/room/RoomView';
import { apiRequest } from '@/lib/utils';

interface RoomData {
  id: string;
  slug: string;
  name: string;
  createdBy: string;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const slug = params.slug as string;
  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const fetchRoom = async () => {
      try {
        const data = await apiRequest<RoomData>(`/api/rooms/${slug}`);
        setRoom(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Room not found');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoom();
  }, [slug]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p className="text-[var(--color-text-muted)] text-sm">Loading room...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 text-center max-w-md w-full"
        >
          <div className="w-16 h-16 rounded-full bg-[var(--color-error)]/10 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Room Not Found</h2>
          <p className="text-[var(--color-text-muted)] text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="btn-gradient"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  if (!user || !room) return null;

  const searchParams = useSearchParams();
  const loadUrl = searchParams.get('loadUrl') || undefined;
  const loadType = searchParams.get('loadType') || undefined;
  const loadResolved = searchParams.get('loadResolved') || undefined;
  const loadTitle = searchParams.get('loadTitle') || undefined;

  return (
    <RoomView
      roomSlug={room.slug}
      roomName={room.name}
      userId={user.id}
      username={user.username}
      createdBy={room.createdBy}
      initialVideoUrl={loadUrl}
      initialVideoType={loadType}
      initialResolvedUrl={loadResolved}
      initialVideoTitle={loadTitle}
    />
  );
}
