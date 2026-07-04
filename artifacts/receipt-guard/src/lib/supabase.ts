import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Graceful degradation: when Supabase env vars are missing (e.g. during dev without
// credentials), create a no-op client so the app renders instead of crashing.
// Auth actions will fail with a clear error when called.
const _url = supabaseUrl || 'https://placeholder.supabase.co';
const _key = supabaseAnonKey || 'placeholder-anon-key';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[ReceiptGuard] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set. ' +
    'Authentication will not work until these secrets are configured.'
  );
}

export const supabase = createClient(_url, _key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export type SupabaseUser = Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'];
