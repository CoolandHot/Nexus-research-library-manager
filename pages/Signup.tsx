
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, UserPlus, ArrowLeft, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { authSupabase } from '../lib/supabase';
import { Profile } from '../types';

interface SignupProps {
  onAuthSuccess: (profile: Profile) => void;
}

const Signup: React.FC<SignupProps> = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    password: '', 
    username: '' 
  });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    const cleanUsername = formData.username.toLowerCase().trim().replace(/\s+/g, '_');

    // Call the signup_user RPC function for secure hashing
    const { data, error: rpcError } = await authSupabase.rpc('signup_user', {
      p_username: cleanUsername,
      p_password: formData.password
    });

    if (rpcError) {
      setError(rpcError.message);
    } else if (data) {
      onAuthSuccess(data as Profile);
      navigate('/');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-100 relative overflow-hidden">
        <Link to="/login" className="absolute top-8 left-8 text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        
        <div className="text-center mb-10 pt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl text-white font-black text-2xl mb-4 shadow-xl italic relative">
            N
            <ShieldCheck size={16} className="absolute -top-1 -right-1 text-blue-400 fill-blue-400" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight text-center">Nexus Network</h1>
          <p className="text-slate-400 font-bold text-sm mt-2 uppercase tracking-widest">Secure Provisioning</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border flex flex-col space-y-2 bg-red-50 border-red-100 text-red-600">
            <div className="flex items-center space-x-3">
              <AlertCircle size={18} className="shrink-0" />
              <p className="text-xs font-bold leading-tight">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Identifier</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                required
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-blue-500 outline-none font-bold text-sm text-slate-700 transition-all"
                placeholder="scholar_01"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pass-phrase (Min 8 chars)</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                required
                type="password"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-blue-500 outline-none font-bold text-sm text-slate-700 transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center space-x-3 text-sm uppercase tracking-widest"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                <>
                  <span>Create Account</span>
                  <UserPlus size={18} />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start space-x-3">
          <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
          <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
            Infrastructure Security: Nexus uses Blowfish-based hashing (bcrypt) for all credential storage. No plain-text passwords ever touch our logs or database files.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
