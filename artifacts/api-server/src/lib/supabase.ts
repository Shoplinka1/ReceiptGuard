import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _supabaseAdmin: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceKey) {
  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Node.js < 22 has no native WebSocket; supply the 'ws' implementation so
    // Supabase's realtime client can initialise without throwing.
    realtime: { transport: Ws as unknown as typeof WebSocket },
  });
} else {
  console.warn(
    '[ReceiptGuard] Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). ' +
    'DB routes will return 503 until the secrets are configured.'
  );
}

// Proxy that throws a clean 503 when Supabase is not configured.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      // Return a function that yields a standard Supabase-style error object
      return (..._args: unknown[]) => {
        const errResult = { data: null, error: { message: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' }, count: null };
        // Support chaining like .from().select().eq()…
        const chain: any = new Proxy({}, {
          get: (_t, _p) => {
            if (_p === 'then') return undefined; // not a thenable until awaited
            return (..._a: unknown[]) => chain;
          },
        });
        // Override the final await to return the error result
        chain.then = undefined;
        const promise = Promise.resolve(errResult);
        return Object.assign(promise, chain);
      };
    }
    return (_supabaseAdmin as any)[prop];
  },
});

// Verify a user JWT token from the Authorization header and return the user id.
export async function verifyToken(authHeader: string | undefined): Promise<string> {
  if (!_supabaseAdmin) {
    throw new Error('Supabase is not configured');
  }
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  const token = authHeader.split(' ')[1];
  const { data, error } = await _supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Invalid or expired token');
  }
  return data.user.id;
}
