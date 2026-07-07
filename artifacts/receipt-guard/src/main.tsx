import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '';
setBaseUrl(apiBaseUrl || null);

createRoot(document.getElementById('root')!).render(<App />);
