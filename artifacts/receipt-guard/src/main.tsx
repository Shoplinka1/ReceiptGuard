import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';
import { addEntry } from './lib/debug-log';

import App from './App';

import './index.css';

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '';
setBaseUrl(apiBaseUrl || null);

// ── DEBUG: patch window.fetch to log every /api/ request ──────────────────
const _nativeFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  let response: Response | undefined;
  let error: string | null = null;

  try {
    response = await _nativeFetch(input, init);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    const entry = { ts: Date.now(), url, status: null, contentType: null, bodySnippet: null, isJson: false, error };
    addEntry(entry);
    console.error('[DEBUG fetch] network error', entry);
    throw err;
  }

  const contentType = response.headers.get('content-type') ?? null;
  const isJson = !!(contentType && (contentType.includes('application/json') || contentType.includes('+json')));

  let bodySnippet: string | null = null;
  if (!isJson && url.includes('/api/')) {
    try {
      const clone = response.clone();
      const text = await clone.text();
      bodySnippet = text.slice(0, 200);
    } catch {}
  }

  const entry = { ts: Date.now(), url, status: response.status, contentType, bodySnippet, isJson, error: null };
  addEntry(entry);

  if (url.includes('/api/')) {
    console.log('[DEBUG fetch]', {
      url,
      status: response.status,
      contentType,
      isJson,
      bodySnippet: bodySnippet ?? '(json — not sniffed)',
    });
  }

  return response;
};
// ──────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(<App />);
