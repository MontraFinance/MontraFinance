/**
 * Frontend Supabase client for Realtime subscriptions.
 * Uses the public anon key (safe for browser exposure).
 * Gracefully degrades if env vars are missing.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase-client] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — Realtime disabled.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  { realtime: { params: { eventsPerSecond: 10 } } },
);
