import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker
registerSW({ immediate: true });

import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS === 'true' || localStorage.getItem('bulela_dev_bypass') === 'true';

if (!PUBLISHABLE_KEY && !DEV_BYPASS) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans uppercase">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-6 mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4.1a1 1 0 0 0-1.4 0l-2.1 2.1a1 1 0 0 0 0 1.4Z"/><path d="m15.5 7.5-3 3"/><path d="m12.5 10.5-4 4"/><path d="m8.5 14.5-3 3"/><path d="m5.5 17.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-2.1 2.1a1 1 0 0 0 0 1.4Z"/><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Clerk API Key Required</h1>
          <p className="text-slate-500 text-xs mb-6 normal-case">
            Please add your <code className="bg-slate-100 px-1 rounded text-red-600 italic">VITE_CLERK_PUBLISHABLE_KEY</code> to the project settings to enable authentication.
          </p>
          <div className="space-y-4">
            <div className="text-[10px] font-bold text-slate-400">Configuration Pending</div>
            <button 
              onClick={() => {
                localStorage.setItem('bulela_dev_bypass', 'true');
                window.location.reload();
              }}
              className="text-[9px] text-slate-300 hover:text-slate-500 transition-colors cursor-pointer"
            >
              Development Bypass
            </button>
          </div>
        </div>
      </div>
    </StrictMode>
  );
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {PUBLISHABLE_KEY ? (
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          <App />
        </ClerkProvider>
      ) : (
        <App devMode={true} />
      )}
    </StrictMode>,
  );
}