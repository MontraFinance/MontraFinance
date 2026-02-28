/**
 * Subscribes to real-time Postgres changes on the `burn_transactions` table
 * for a specific wallet address via Supabase Realtime.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { BurnRecord } from '@/types/burn';
import type { RealtimeStatus } from '@/hooks/useRealtimeAgents';

interface UseRealtimeBurnsOptions {
  walletAddress: string | null;
  onInsert?: (row: BurnRecord) => void;
  onUpdate?: (row: BurnRecord) => void;
}

export function useRealtimeBurns({
  walletAddress,
  onInsert,
  onUpdate,
}: UseRealtimeBurnsOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const channelRef = useRef<RealtimeChannel | null>(null);

  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!walletAddress) {
      setStatus('disconnected');
      return;
    }

    const normalized = walletAddress.toLowerCase();
    setStatus('connecting');

    const channel = supabase
      .channel(`burns:${normalized}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'burn_transactions',
          filter: `wallet_address=eq.${normalized}`,
        },
        (payload) => {
          onInsertRef.current?.(payload.new as BurnRecord);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'burn_transactions',
          filter: `wallet_address=eq.${normalized}`,
        },
        (payload) => {
          onUpdateRef.current?.(payload.new as BurnRecord);
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
