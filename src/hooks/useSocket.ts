'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_PATH = '/api/socketio';

export type PollResults = {
  results: { id: string; text: string; votesCount: number; percentage: number }[];
  totalVotes: number;
};

export function useSocket(pollId: string | null) {
  const [results, setResults] = useState<PollResults | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!pollId) return;

    const socket = io({
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', pollId);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('results', (payload: PollResults) => {
      setResults(payload);
    });

    return () => {
      socket.emit('leave', pollId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pollId]);

  return { results, connected };
}
