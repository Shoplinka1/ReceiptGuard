/**
 * Thin wrapper around customFetch from api-client-react.
 * Auth token is injected automatically via the _authTokenGetter
 * registered in use-auth.tsx — no explicit token handling needed here.
 */
import { customFetch } from '@workspace/api-client-react';

export async function apiFetch<T = any>(url: string, opts?: RequestInit): Promise<T> {
  return customFetch<T>(url, opts as any);
}
