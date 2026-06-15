import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initGoogleApi, onAuthChange, getSpreadsheetId } from './lib/googleSheets';
import Setup from './pages/Setup';
import Library from './pages/Library';
import { AlertCircle, Database } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const IS_CLIENT_ID_PLACEHOLDER = GOOGLE_CLIENT_ID === 'your-google-oauth-client-id' || !GOOGLE_CLIENT_ID;

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [userSignedIn, setUserSignedIn] = useState(false);
  const [sheetConfigured, setSheetConfigured] = useState(false);

  useEffect(() => {
    if (IS_CLIENT_ID_PLACEHOLDER) {
      setIsInitialized(true);
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    initGoogleApi(GOOGLE_CLIENT_ID).then(() => {
      if (!isMounted) return;
      setIsInitialized(true);
      unsubscribe = onAuthChange((signedIn) => {
        setUserSignedIn(signedIn);
        setSheetConfigured(!!getSpreadsheetId());
      });
    });

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Guard for missing Client ID configuration
  if (IS_CLIENT_ID_PLACEHOLDER) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
        <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl mb-6 shadow-lg shadow-amber-100">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Configuration Required</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">
            NexusResearch requires a Google OAuth Client ID to authenticate.
          </p>
          <div className="bg-blue-50 p-6 rounded-[2rem] text-left border border-blue-100">
            <div className="flex items-center space-x-2 text-blue-600 mb-3">
              <Database size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Environment Setup</span>
            </div>
            <p className="text-xs text-slate-600 mb-2 leading-relaxed">
              Create a <strong>.env.local</strong> file in the project root and add your Google Client ID:
            </p>
            <pre className="text-[11px] font-mono text-blue-800 break-all overflow-x-auto bg-white/50 p-3 rounded-xl border border-blue-100">
              VITE_GOOGLE_CLIENT_ID=your-client-id-here
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isReady = userSignedIn && sheetConfigured;

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            isReady ? <Library /> : <Navigate to="/setup" />
          }
        />
        <Route
          path="/setup"
          element={
            <Setup onConfigured={() => setSheetConfigured(true)} />
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
