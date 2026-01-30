
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, LogIn, ArrowRight, AlertCircle, ShieldCheck, Clock } from 'lucide-react';
import { authSupabase } from '../lib/supabase';
import { Profile } from '../types';

interface LoginProps {
  onAuthSuccess: (profile: Profile) => void;
}

const Login: React.FC<LoginProps> = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [formData, setFormData] = useState({ username: '', password: '' });

  useEffect(() => {
    let timer: number;
    if (lockoutTime > 0) {
      timer = window.setInterval(() => {
        setLockoutTime(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTime]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) return;
    
    setLoading(true);
    setError(null);

    const cleanUsername = formData.username.toLowerCase().trim();

    // Call the signin_user RPC function
    const { data, error: rpcError } = await authSupabase.rpc('signin_user', {
      p_username: cleanUsername,
      p_password: formData.password
    });

    if (rpcError) {
      const msg = rpcError.message;
      if (msg.includes('locked')) {
        const match = msg.match(/\d+/);
        const seconds = match ? parseInt(match[0]) : 30;
        setLockoutTime(seconds);
        setError(msg);
      } else {
        setError(msg);
      }
    } else if (data) {
      onAuthSuccess(data as Profile);
      navigate('/');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl text-white font-black text-2xl mb-4 shadow-xl shadow-blue-200 italic relative">
            N
            <ShieldCheck size={16} className="absolute -top-1 -right-1 text-emerald-400 fill-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Nexus Vault</h1>
          <p className="text-slate-400 font-bold text-sm mt-2 uppercase tracking-widest flex items-center justify-center space-x-2">
            <span>Encrypted Entry</span>
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start space-x-3 text-red-600 animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="text-xs font-bold leading-tight">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Identity</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                required
                disabled={lockoutTime > 0}
                type="text"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-blue-500 outline-none font-bold text-sm text-slate-700 transition-all disabled:opacity-50"
                placeholder="username"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pass-phrase</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                required
                disabled={lockoutTime > 0}
                type="password"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-blue-500 outline-none font-bold text-sm text-slate-700 transition-all disabled:opacity-50"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || lockoutTime > 0}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all flex items-center justify-center space-x-3 text-sm uppercase tracking-widest disabled:bg-slate-300 disabled:shadow-none"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
              <>
                {lockoutTime > 0 ? (
                  <div className="flex items-center space-x-2">
                    <Clock size={18} />
                    <span>Wait {lockoutTime}s</span>
                  </div>
                ) : (
                  <>
                    <span>Unlock Access</span>
                    <LogIn size={18} />
                  </>
                )}
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No keys?</p>
          <Link to="/signup" className="mt-3 inline-flex items-center space-x-2 text-blue-600 font-black hover:translate-x-1 transition-all">
            <span>Initialize Account</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
