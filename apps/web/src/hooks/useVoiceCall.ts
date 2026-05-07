'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ServerToClientEvents } from '@/types';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface UseVoiceCallOptions {
  on: <E extends keyof ServerToClientEvents>(event: E, handler: ServerToClientEvents[E]) => () => void;
  emit: (event: string, data: unknown) => void;
  roomSlug: string;
  userId: string;
}

export function useVoiceCall({ on, emit, roomSlug, userId }: UseVoiceCallOptions) {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Create remote audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    remoteAudioRef.current = audio;
    return () => { audio.pause(); audio.srcObject = null; };
  }, []);

  const createPeer = useCallback((fromUserId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        emit('voice:ice-candidate', {
          roomSlug,
          candidate: JSON.stringify(e.candidate),
          targetUserId: fromUserId,
        });
      }
    };

    pc.ontrack = (e) => {
      if (remoteAudioRef.current && e.streams[0]) {
        remoteAudioRef.current.srcObject = e.streams[0];
        setPeerConnected(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setPeerConnected(false);
      }
    };

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerRef.current = pc;
    return pc;
  }, [emit, roomSlug]);

  // Join voice call
  const joinCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setIsInCall(true);
      emit('voice:join', { roomSlug });
    } catch (err) {
      console.error('[Voice] Mic access denied:', err);
    }
  }, [emit, roomSlug]);

  // Leave voice call
  const leaveCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setIsInCall(false);
    setPeerConnected(false);
    setIsMuted(false);
    emit('voice:leave', { roomSlug });
  }, [emit, roomSlug]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    }
  }, []);

  // Handle: someone joined voice → send offer
  useEffect(() => {
    const unsub = on('voice:user-joined', async (data) => {
      if (!isInCall || !localStreamRef.current) return;

      const pc = createPeer(data.userId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      emit('voice:offer', {
        roomSlug,
        sdp: JSON.stringify(offer),
        targetUserId: data.userId,
      });
    });
    return unsub;
  }, [on, isInCall, createPeer, emit, roomSlug]);

  // Handle: received offer → send answer
  useEffect(() => {
    const unsub = on('voice:offer', async (data) => {
      if (!isInCall || !localStreamRef.current) return;

      const pc = createPeer(data.from);
      await pc.setRemoteDescription(JSON.parse(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      emit('voice:answer', {
        roomSlug,
        sdp: JSON.stringify(answer),
        targetUserId: data.from,
      });
    });
    return unsub;
  }, [on, isInCall, createPeer, emit, roomSlug]);

  // Handle: received answer
  useEffect(() => {
    const unsub = on('voice:answer', async (data) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(JSON.parse(data.sdp));
      }
    });
    return unsub;
  }, [on]);

  // Handle: received ICE candidate
  useEffect(() => {
    const unsub = on('voice:ice-candidate', async (data) => {
      if (peerRef.current) {
        await peerRef.current.addIceCandidate(JSON.parse(data.candidate));
      }
    });
    return unsub;
  }, [on]);

  // Handle: user left voice
  useEffect(() => {
    const unsub = on('voice:user-left', () => {
      peerRef.current?.close();
      peerRef.current = null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      setPeerConnected(false);
    });
    return unsub;
  }, [on]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peerRef.current?.close();
    };
  }, []);

  return { isInCall, isMuted, peerConnected, joinCall, leaveCall, toggleMute };
}
