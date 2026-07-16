import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const _url = supabaseUrl || 'https://placeholder.supabase.co';
const _key = supabaseAnonKey || 'placeholder-anon-key';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[AdminApp] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set. ' +
    'Authentication will not work until these secrets are configured.',
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
