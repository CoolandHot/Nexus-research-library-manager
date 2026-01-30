
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Database, Key, Copy, Check, ArrowLeft, Zap, LogOut, AlertCircle, ShieldAlert } from 'lucide-react';
import { LIBRARY_SCHEMA, PRIMARY_SCHEMA, authSupabase } from '../lib/supabase';
import { Profile } from '../types';

interface SetupProps {
  profile: Profile | null;
  onComplete: (profile: Profile) => void;
  onLogout: () => void;
}

const Setup: React.FC<SetupProps> = ({ profile, onComplete, onLogout }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [copiedGlobal, setCopiedGlobal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGlobalFix, setShowGlobalFix] = useState(false);
  
  const [formData, setFormData] = useState({
    supabaseUrl: '',
    supabaseAnonKey: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        supabaseUrl: profile.library_url || '',
        supabaseAnonKey: profile.library_key || '',
      });
    }
  }, [profile]);

  const handleCopySql = (sql: string, type: 'library' | 'global') => {
    navigator.clipboard.writeText(sql);
    if (type === 'library') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopiedGlobal(true);
      setTimeout(() => setCopiedGlobal(false), 2000);
    }
  };

  const handleLogout = async () => {
    onLogout();
    navigate('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    setError(null);
    setShowGlobalFix(false);

    try {
      // Use RPC instead of direct table update
      const { data, error: rpcError } = await authSupabase.rpc('update_profile', {
        p_user_id: profile.id,
        p_url: formData.supabaseUrl.trim(),
        p_key: formData.supabaseAnonKey.trim(),
      });

      if (rpcError) {
        if (rpcError.message.includes('not found') || rpcError.message.includes('rpc')) {
          setError("Global function 'update_profile' not found. You must run the Global Schema script in your Primary Supabase project.");
          setShowGlobalFix(true);
        } else {
          setError(rpcError.message);
        }
      } else if (data) {
        onComplete(data as Profile);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden">
        
        {profile?.library_url && (
          <button 
            onClick={() => navigate('/')}
            className="absolute top-8 left-8 flex items-center space-x-2 text-slate-500 hover:text-blue-600 transition-all font-black text-[10px] uppercase tracking-widest bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 z-10"
          >
            <ArrowLeft size={16} />
            <span>Library</span>
          </button>
        )}

        <button 
          onClick={handleLogout}
          className="absolute top-8 right-8 flex items-center space-x-2 text-red-500 hover:text-red-600 transition-all font-black text-[10px] uppercase tracking-widest bg-red-50 px-6 py-3 rounded-2xl border border-red-100 z-10"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>

        <div className="space-y-8 pt-12 lg:pt-0">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Connect Library</h2>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">Step 1: Database Initialization</p>
          </div>
          
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Nexus is a decentralized manager. Run this schema in your <span className="text-blue-600 font-black">Personal Supabase SQL Editor</span> to create your private library tables.
          </p>
          
          <div className="relative group">
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={() => handleCopySql(LIBRARY_SCHEMA, 'library')}
                className="p-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-2xl transition-all flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest shadow-2xl"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy Script'}</span>
              </button>
            </div>
            <div className="bg-slate-900 rounded-[2.5rem] p-8 pt-20 overflow-hidden border-4 border-slate-800 shadow-2xl relative">
              <div className="absolute top-6 left-8 flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              </div>
              <pre className="text-[11px] text-blue-300 font-mono overflow-x-auto h-80 custom-scrollbar leading-relaxed">
                {LIBRARY_SCHEMA}
              </pre>
            </div>
          </div>
        </div>

        <div className="space-y-10 lg:pl-10 lg:border-l border-slate-100">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Cloud Credentials</h3>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Step 2: Linking Account</p>
          </div>

          {error && (
            <div className="p-6 bg-red-50 border border-red-100 rounded-3xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-start space-x-3 text-red-600">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="text-xs font-bold leading-tight">{error}</p>
              </div>
              
              {showGlobalFix && (
                <div className="p-4 bg-white/50 rounded-2xl border border-red-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Global SQL Fix</span>
                    <button 
                      onClick={() => handleCopySql(PRIMARY_SCHEMA, 'global')}
                      className="text-[9px] font-black bg-red-600 text-white px-3 py-1.5 rounded-lg flex items-center space-x-2"
                    >
                      {copiedGlobal ? <Check size={10} /> : <Copy size={10} />}
                      <span>{copiedGlobal ? 'Copied' : 'Copy SQL'}</span>
                    </button>
                  </div>
                  <pre className="text-[9px] font-mono text-slate-600 max-h-32 overflow-y-auto bg-slate-50 p-2 rounded-lg">
                    {PRIMARY_SCHEMA}
                  </pre>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">Supabase Project URL</label>
              <div className="relative">
                <Database className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  required
                  type="text"
                  placeholder="https://xyz.supabase.co"
                  className="w-full pl-14 pr-6 py-5 border-2 border-slate-50 bg-slate-50 rounded-3xl focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-inner"
                  value={formData.supabaseUrl}
                  onChange={(e) => setFormData({...formData, supabaseUrl: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">Supabase Anon Key</label>
              <div className="relative">
                <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  required
                  type="password"
                  placeholder="eyJhbG..."
                  className="w-full pl-14 pr-6 py-5 border-2 border-slate-50 bg-slate-50 rounded-3xl focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-inner"
                  value={formData.supabaseAnonKey}
                  onChange={(e) => setFormData({...formData, supabaseAnonKey: e.target.value})}
                />
              </div>
            </div>

            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-start space-x-4">
              <Zap className="text-blue-600 shrink-0" size={20} />
              <p className="text-[11px] text-blue-700 font-bold leading-relaxed italic">
                Nexus credentials are saved to your encrypted profile record in the global database.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-6 rounded-3xl transition-all shadow-2xl shadow-blue-200 flex items-center justify-center space-x-4 text-sm uppercase tracking-widest active:scale-[0.98]"
            >
              {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                <>
                  <Settings size={22} />
                  <span>Finalize & Link Library</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Setup;
