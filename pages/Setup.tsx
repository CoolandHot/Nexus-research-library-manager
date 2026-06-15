import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Check, AlertCircle, ArrowRight, ArrowLeft, Lock, LogOut, RefreshCw, Library } from 'lucide-react';
import { 
  signIn, 
  signOut, 
  isSignedIn, 
  onAuthChange, 
  setSpreadsheetId, 
  getSpreadsheetId, 
  fetchSheetNames 
} from '../lib/googleSheets';

interface SetupProps {
  onConfigured?: () => void;
}

const Setup: React.FC<SetupProps> = ({ onConfigured }) => {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(isSignedIn());
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState(getSpreadsheetId() || '');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabsFound, setTabsFound] = useState<string[] | null>(null);

  useEffect(() => {
    // Listen for auth changes
    const unsubscribe = onAuthChange((isAuthed) => {
      setSignedIn(isAuthed);
      if (!isAuthed) {
        setTabsFound(null);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-connect on mount/auth if credentials exist
  useEffect(() => {
    if (signedIn && spreadsheetIdInput && !tabsFound && !testing) {
      setTesting(true);
      setError(null);
      fetchSheetNames()
        .then((names) => {
          setTabsFound(names);
        })
        .catch((err) => {
          setError(err?.message || 'Failed to auto-connect to Google Sheets. Verify the Spreadsheet ID and try again.');
        })
        .finally(() => {
          setTesting(false);
        });
    }
  }, [signedIn]);

  const handleSignIn = async () => {
    setError(null);
    try {
      await signIn();
    } catch (err: any) {
      setError(err?.message || err?.error || 'Failed to sign in with Google');
    }
  };

  const handleSignOut = () => {
    signOut();
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedIn) return;
    
    setTesting(true);
    setError(null);
    setTabsFound(null);

    const targetId = spreadsheetIdInput.trim();
    if (!targetId) {
      setError('Please enter a Google Spreadsheet ID');
      setTesting(false);
      return;
    }

    // Save to local storage to test
    setSpreadsheetId(targetId);

    try {
      const names = await fetchSheetNames();
      setTabsFound(names);
      if (onConfigured) {
        onConfigured();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to Google Sheets. Verify the Spreadsheet ID and try again.');
      // Revert if connection failed
      localStorage.removeItem('google_spreadsheet_id');
    } finally {
      setTesting(false);
    }
  };

  const handleProceed = () => {
    if (tabsFound && tabsFound.length > 0) {
      if (onConfigured) {
        onConfigured();
      }
      navigate('/');
    }
  };

  // Helper to extract sheet ID from URL
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('Text');
    const match = pastedText.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      e.preventDefault();
      setSpreadsheetIdInput(match[1]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden">
        
        {getSpreadsheetId() && (
          <button 
            onClick={() => navigate('/')}
            className="absolute top-8 left-8 flex items-center space-x-2 text-slate-500 hover:text-blue-600 transition-all font-black text-[10px] uppercase tracking-widest bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 z-10"
          >
            <ArrowLeft size={16} />
            <span>Library</span>
          </button>
        )}

        {signedIn && (
          <button 
            onClick={handleSignOut}
            className="absolute top-8 right-8 flex items-center space-x-2 text-red-500 hover:text-red-600 transition-all font-black text-[10px] uppercase tracking-widest bg-red-50 px-6 py-3 rounded-2xl border border-red-100 z-10"
          >
            <LogOut size={16} />
            <span>Disconnect</span>
          </button>
        )}

        {/* Left Side: Setup Overview */}
        <div className="space-y-8 pr-4">
          <div className="flex items-center space-x-3.5 mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
              <Library size={24} className="stroke-[2.25]" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Nexus</h2>
              <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[9px] mt-1.5">Research Library</p>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Library Setup</h3>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">Google Sheets Integration</p>
          </div>
          
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            NexusResearch uses a single Google Spreadsheet as a decentralized database. Sheet tabs act as folder collections, and your literature is synced directly to rows.
          </p>

          <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 space-y-4">
            <div className="flex items-center space-x-2 text-blue-600">
              <FileSpreadsheet size={18} />
              <span className="text-xs font-black uppercase tracking-widest">Required Columns</span>
            </div>
            <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
              Each sheet tab in your spreadsheet must have the following column headers in row 1 (columns A to F):
            </p>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-blue-900 bg-white/50 p-3 rounded-xl border border-blue-100">
              <div>A: BibTex</div>
              <div>B: Title@year</div>
              <div>C: Summary</div>
              <div>D: Critical evaluation</div>
              <div>E: Relevance</div>
              <div>F: Snippet</div>
            </div>
          </div>
        </div>

        {/* Right Side: Credentials & Settings */}
        <div className="space-y-8 lg:pl-10 lg:border-l border-slate-100 flex flex-col justify-center">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Configuration</h3>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">
              {!signedIn ? 'Step 1: Authenticate' : 'Step 2: Connect Spreadsheet'}
            </p>
          </div>

          {error && (
            <div className="p-6 bg-red-50 border border-red-100 rounded-3xl animate-in fade-in zoom-in-95">
              <div className="flex items-start space-x-3 text-red-600">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="text-xs font-bold leading-tight">{error}</p>
              </div>
            </div>
          )}

          {!signedIn ? (
            <div className="space-y-6">
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                To access your personal library spreadsheet, please authorize with your Google account.
              </p>
              
              <button
                type="button"
                onClick={handleSignIn}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-6 rounded-3xl transition-all shadow-2xl shadow-blue-200 flex items-center justify-center space-x-4 text-sm uppercase tracking-widest active:scale-[0.98]"
              >
                <Lock size={20} />
                <span>Sign in with Google</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleTestConnection} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
                  Google Spreadsheet ID / URL
                </label>
                <div className="relative">
                  <FileSpreadsheet className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    required
                    type="text"
                    placeholder="Paste spreadsheet URL or ID"
                    onPaste={handleUrlPaste}
                    className="w-full pl-14 pr-6 py-5 border-2 border-slate-50 bg-slate-50 rounded-3xl focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-bold text-slate-700 shadow-inner"
                    value={spreadsheetIdInput}
                    onChange={(e) => setSpreadsheetIdInput(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-slate-400 px-1 leading-relaxed">
                  Tip: You can paste the entire Google Sheet URL and we will automatically extract the ID.
                </p>
              </div>

              {tabsFound && (
                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl space-y-3 animate-in fade-in zoom-in-95">
                  <div className="flex items-center space-x-2 text-emerald-600">
                    <Check size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">Successfully Connected!</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 font-bold leading-normal">
                    Found {tabsFound.length} sheet folders: {tabsFound.join(', ')}
                  </p>
                </div>
              )}

              {!tabsFound ? (
                <button
                  type="submit"
                  disabled={testing}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-6 rounded-3xl transition-all shadow-2xl shadow-blue-200 flex items-center justify-center space-x-4 text-sm uppercase tracking-widest active:scale-[0.98] disabled:opacity-50"
                >
                  {testing ? (
                    <RefreshCw size={20} className="animate-spin" />
                  ) : (
                    <span>Test & Connect Library</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleProceed}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-6 rounded-3xl transition-all shadow-2xl shadow-emerald-200 flex items-center justify-center space-x-4 text-sm uppercase tracking-widest active:scale-[0.98]"
                >
                  <span>Go to Library</span>
                  <ArrowRight size={20} />
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Setup;
