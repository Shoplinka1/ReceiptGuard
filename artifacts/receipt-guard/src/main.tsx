import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// Point every API call (both the generated api-client-react hooks and the
// ad-hoc fetch() calls in individual pages) at the deployed backend.
// Without this, relative paths like `/api/...` resolve against the
// frontend's own origin (Vercel), which has no /api route — its SPA
// catch-all rewrite returns index.html (HTML) with a 200 status instead
// of a real API response, and downstream code that expects JSON crashes.
const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '';
setBaseUrl(apiBaseUrl || null);

createRoot(document.getElementById('root')!).render(<App />);
