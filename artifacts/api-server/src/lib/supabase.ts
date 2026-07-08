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

// Proxy that returns a graceful no-op when Supabase is not configured.
// The stub supports full chaining (.from().select().eq()…) and resolves to
// { data: null, error: { message: '...' }, count: null } when awaited —
// exactly the same shape as real Supabase responses.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      const errResult = {
        data: null,
        error: { message: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' },
        count: null,
      };
      // Build a chainable thenable: any method call returns the same object.
      // Using a function-based approach so the proxy has a callable [[Call]] slot
      // (required for chaining like .from(...).select(...).eq(...)...).
      function makeChain(): any {
        const p: any = new Proxy(function chain() {}, {
          get(_t, key) {
            if (key === 'then') {
              // Make it a thenable that resolves to the error result
              return (onFulfilled: any) => Promise.resolve(errResult).then(onFulfilled);
            }
            if (key === 'catch') return (f: any) => Promise.resolve(errResult).catch(f);
            if (key === 'finally') return (f: any) => Promise.resolve(errResult).finally(f);
            return () => p;
          },
          apply() { return p; },
        });
        return p;
      }
      // Return a function for any top-level property access (e.g. .from, .auth, .storage)
      return () => makeChain();
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
