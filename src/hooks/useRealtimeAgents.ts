/**
 * Subscribes to real-time Postgres changes on the `agents` table
 * for a specific wallet address via Supabase Realtime.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type AgentRow = Record<string, unknown>;

interface UseRealtimeAgentsOptions {
  walletAddress: string | null;
  onInsert?: (row: AgentRow) => void;
  onUpdate?: (row: AgentRow, oldRow: Partial<AgentRow>) => void;
  onDelete?: (oldRow: Partial<AgentRow>) => void;
}

export function useRealtimeAgents({
  walletAddress,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeAgentsOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Stable callback refs — avoids tearing down the channel on every render
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;
  onDeleteRef.current = onDelete;

  useEffect(() => {
    if (!walletAddress) {
      setStatus('disconnected');
      return;
    }

    const normalized = walletAddress.toLowerCase();
    setStatus('connecting');

    const channel = supabase
      .channel(`agents:${normalized}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents',
          filter: `wallet_address=eq.${normalized}`,
        },
        (payload) => {
          switch (payload.eventType) {
            case 'INSERT':
              onInsertRef.current?.(payload.new as AgentRow);
              break;
            case 'UPDATE':
              onUpdateRef.current?.(payload.new as AgentRow, payload.old as Partial<AgentRow>);
              break;
            case 'DELETE':
              onDeleteRef.current?.(payload.old as Partial<AgentRow>);
              break;
          }
        },
      )
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') setStatus('connected');
        else if (s === 'CLOSED' || s === 'CHANNEL_ERROR') setStatus('error');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setStatus('disconnected');
    };
  }, [walletAddress]);

  return { status };
}
