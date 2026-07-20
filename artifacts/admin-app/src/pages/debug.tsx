/**
 * /debug — diagnostic page, no auth required.
 * Visit https://receipt-guard-admin-app-3ekx.vercel.app/debug to see:
 *  - whether Supabase has a session
 *  - the user ID and email Supabase returns
 *  - the raw HTTP status + body from /api/user/profile
 * This lets us diagnose "Access Denied" without browser DevTools.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '';

interface DiagResult {
  ts: string;
  supabaseUrl: string;
  apiBase: string;
  pageUrl: string;
  sessionPresent: boolean;
  userId: string | null;
  userEmail: string | null;
  profileHttpStatus: number | null;
  profileBody: unknown;
  profileError: string | null;
  fetchError: string | null;
}

export default function DebugPage() {
  const [result, setResult] = useState<DiagResult | null>(null);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    (async () => {
      const diag: DiagResult = {
        ts: new Date().toISOString(),
        supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '(not set)',
        apiBase: API_BASE || '(empty — same-origin via Vercel proxy)',
        pageUrl: window.location.href,
        sessionPresent: false,
        userId: null,
        userEmail: null,
        profileHttpStatus: null,
        profileBody: null,
        profileError: null,
        fetchError: null,
      };

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          diag.sessionPresent = true;
          diag.userId = session.user.id;
          diag.userEmail = session.user.email ?? null;

          try {
            const url = `${API_BASE}/api/user/profile`;
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            diag.profileHttpStatus = res.status;
            try {
              diag.profileBody = await res.json();
            } catch {
              diag.profileBody = '(non-JSON response body)';
            }
          } catch (e: any) {
            diag.profileError = e?.message ?? String(e);
          }
        }
      } catch (e: any) {
        diag.fetchError = e?.message ?? String(e);
      }

      setResult(diag);
      setRunning(false);
    })();
  }, []);

  const pre = (label: string, value: unknown) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ color: '#0f0', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '—')}
      </div>
    </div>
  );

  return (
    <div style={{
      background: '#0a0a0a', color: '#ccc', minHeight: '100vh',
      padding: '24px 16px', fontFamily: 'monospace', fontSize: 13,
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', marginTop: 0, fontSize: 16, borderBottom: '1px solid #333', paddingBottom: 8 }}>
          Admin App — Auth Diagnostics
        </h2>

        {running && <p style={{ color: '#aaa' }}>Running checks…</p>}

        {result && (
          <>
            {pre('timestamp', result.ts)}
            {pre('page url', result.pageUrl)}
            {pre('supabase url', result.supabaseUrl)}
            {pre('api base url', result.apiBase)}
            <hr style={{ borderColor: '#333', margin: '16px 0' }} />
            {pre('session present', result.sessionPresent)}
            {pre('supabase user id', result.userId)}
            {pre('supabase user email', result.userEmail)}
            <hr style={{ borderColor: '#333', margin: '16px 0' }} />
            {pre('/api/user/profile — http status', result.profileHttpStatus)}
            {pre('/api/user/profile — body', result.profileBody)}
            {result.profileError && pre('profile fetch error', result.profileError)}
            {result.fetchError && pre('session fetch error', result.fetchError)}
          </>
        )}

        <hr style={{ borderColor: '#333', margin: '24px 0' }} />
        <p style={{ color: '#555', fontSize: 11 }}>
          Screenshot this page and share it to diagnose admin access issues.
          No sensitive credentials are shown — only user IDs, email, and HTTP status codes.
        </p>
      </div>
    </div>
  );
}
