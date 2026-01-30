
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { authSupabase, initLibraryClient, isAuthReady } from './lib/supabase';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Setup from './pages/Setup';
import Library from './pages/Library';
import SharedView from './pages/SharedView';
import { Profile } from './types';
import { AlertCircle, Database } from 'lucide-react';

const App: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If the primary database is not configured, we cannot perform auth operations.
    if (!isAuthReady) {
      setLoading(false);
      return;
    }

    // Load session from localStorage for custom table-based auth
    const savedUser = localStorage.getItem('nexus_user');
    if (savedUser) {
      try {
        const parsedProfile = JSON.parse(savedUser) as Profile;
        setProfile(parsedProfile);
        if (parsedProfile.library_url && parsedProfile.library_key) {
          initLibraryClient(parsedProfile.library_url, parsedProfile.library_key);
        }
      } catch (e) {
        localStorage.removeItem('nexus_user');
      }
    }
    setLoading(false);
  }, []);

  const handleAuthSuccess = (newProfile: Profile) => {
    setProfile(newProfile);
    localStorage.setItem('nexus_user', JSON.stringify(newProfile));
    if (newProfile.library_url && newProfile.library_key) {
      initLibraryClient(newProfile.library_url, newProfile.library_key);
    }
  };

  const handleLogout = () => {
    setProfile(null);
    localStorage.removeItem('nexus_user');
  };

  // Guard for missing Primary Database configuration
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
        <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-2xl mb-6 shadow-lg shadow-red-100">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Configuration Required</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">
            NexusResearch requires a Primary Supabase project to handle your global profile.
          </p>
          <div className="bg-blue-50 p-6 rounded-[2rem] text-left border border-blue-100">
            <div className="flex items-center space-x-2 text-blue-600 mb-3">
              <Database size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Global Table Setup</span>
            </div>
            <pre className="text-[11px] font-mono text-blue-800 break-all overflow-x-auto bg-white/50 p-3 rounded-xl border border-blue-100">
              SUPABASE_URL=...<br />
              SUPABASE_ANON_KEY=...
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            !profile ? <Navigate to="/login" /> :
              !profile.library_url ? <Navigate to="/setup" /> :
                <Library profile={profile} onLogout={handleLogout} />
          }
        />
        <Route
          path="/login"
          element={profile ? <Navigate to="/" /> : <Login onAuthSuccess={handleAuthSuccess} />}
        />
        <Route
          path="/signup"
          element={profile ? <Navigate to="/" /> : <Signup onAuthSuccess={handleAuthSuccess} />}
        />
        <Route
          path="/setup"
          element={
            !profile ? <Navigate to="/login" /> :
              <Setup profile={profile} onComplete={handleAuthSuccess} onLogout={handleLogout} />
          }
        />
        <Route path="/share/:shareId" element={<SharedView />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
