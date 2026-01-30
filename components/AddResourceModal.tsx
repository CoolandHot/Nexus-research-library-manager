
import React, { useState, useRef } from 'react';
import { X, FileText, Globe, List, Loader2, Save, Database, Plus, Star, Tag, Upload, FileSpreadsheet, Hash, Share2 } from 'lucide-react';
import { Folder, PaperType } from '../types';
import { fetchCrossRefMetadata, parseBibTeX } from '../lib/metadata';
import { authSupabase } from '../lib/supabase';

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onAdd: (papers: any[]) => Promise<void>;
  initialMode?: 'manual' | 'bibtex' | 'bulk' | 'csv' | 'share';
}

const AddResourceModal: React.FC<AddResourceModalProps> = ({ isOpen, onClose, folders, onAdd, initialMode = 'manual' }) => {
  const [mode, setMode] = useState<'manual' | 'bibtex' | 'bulk' | 'csv' | 'share'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manualPaper, setManualPaper] = useState({
    title: '',
    url: '',
    pdf_link: '',
    doi: '',
    type: 'web' as PaperType,
    authors: '',
    published_year: '',
    summary: '',
    abstract: '',
    userLabel: '',
    importance: 0,
    critical_evaluation: '',
    remarks: '',
    useful_snippet: ''
  });
  const [bibtexInput, setBibtexInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [shareInput, setShareInput] = useState('');

  if (!isOpen) return null;

  const handleFetchMetadata = async () => {
    if (!manualPaper.url) return;
    setFetchingMetadata(true);
    try {
      const data = await fetchCrossRefMetadata(manualPaper.url);
      if (data) {
        setManualPaper(prev => ({ ...prev, ...data }));
      } else {
        alert("No metadata found for this DOI.");
      }
    } catch (e) {
      console.error("Fetch metadata failed", e);
    } finally {
      setFetchingMetadata(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { userLabel, ...rest } = manualPaper;
      await onAdd([{
        ...rest,
        user_label: userLabel,
        folder_id: selectedFolder || null
      }]);
      onClose();
    } catch (e) {
      console.error("Add paper failed", e);
      alert("Failed to add paper.");
    } finally {
      setLoading(false);
    }
  };

  const handleBibtexImport = async () => {
    if (!bibtexInput.trim()) return;
    setLoading(true);
    try {
      const parsed = parseBibTeX(bibtexInput);
      if (parsed.length > 0) {
        await onAdd(parsed.map(p => ({ ...p, folder_id: selectedFolder || null })));
        onClose();
      } else {
        alert("Could not parse BibTeX.");
      }
    } catch (e) {
      console.error("Bibtex import failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    const urls = bulkInput.split('\n').filter(u => u.trim().startsWith('http'));
    if (urls.length === 0) return;
    setLoading(true);
    try {
      const papers = urls.map(url => ({
        url: url.trim(),
        title: url.split('/').pop()?.split('?')[0] || 'Untitled Resource',
        type: (url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'web') as PaperType,
        folder_id: selectedFolder || null
      }));
      await onAdd(papers);
      onClose();
    } catch (e) {
      console.error("Bulk import failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          alert("Invalid CSV format.");
          setLoading(false);
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const papers = lines.slice(1).filter(l => l.trim()).map(line => {
          const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          const paper: any = { folder_id: selectedFolder || null, type: 'web' };

          headers.forEach((h, i) => {
            const val = parts[i];
            if (h === 'user_label') paper.user_label = val;
            else if (h === 'pdf_link') paper.pdf_link = val;
            else if (h === 'published_year') paper.published_year = val;
            else if (h === 'importance') paper.importance = parseInt(val) || 0;
            else if (['title', 'authors', 'doi', 'url', 'summary', 'abstract', 'critical_evaluation', 'remarks', 'useful_snippet'].includes(h)) {
              paper[h] = val;
            }
          });

          if (paper.url && paper.url.toLowerCase().endsWith('.pdf')) paper.type = 'pdf';
          return paper;
        });

        if (papers.length > 0) {
          await onAdd(papers);
          onClose();
        } else {
          alert("No valid papers found in CSV.");
        }
      } catch (err) {
        console.error("CSV import failed", err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleShareLinkImport = async () => {
    if (!shareInput.trim()) return;
    setLoading(true);
    try {
      // Extract share ID from URL or use as-is
      let shareId = shareInput.trim();
      if (shareId.includes('/share/')) {
        shareId = shareId.split('/share/').pop()?.split('?')[0] || shareId;
      }
      if (shareId.includes('#/share/')) {
        shareId = shareId.split('#/share/').pop()?.split('?')[0] || shareId;
      }

      if (!authSupabase) throw new Error('Database not initialized');

      const { data: linkData, error: linkError } = await authSupabase
        .from('share_links')
        .select('*')
        .eq('share_id', shareId)
        .single();

      if (linkError || !linkData) {
        alert('Share link not found. Please check the URL.');
        setLoading(false);
        return;
      }

      const papers = (linkData.papers || []).map((p: any) => {
        const { id, userLabel, ...rest } = p; // Remove id completely
        return {
          ...rest,
          folder_id: selectedFolder || null,
          user_label: userLabel || p.user_label // Support both naming conventions
        };
      });

      if (papers.length > 0) {
        await onAdd(papers);
        onClose();
      } else {
        alert('No papers found in this share link.');
      }
    } catch (err: any) {
      console.error('Share link import failed', err);
      alert('Failed to import from share link: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-2xl font-black text-slate-800 flex items-center space-x-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Plus size={24} /></div>
            <span>New Research Entry</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-xl">
            <X size={28} />
          </button>
        </div>

        <div className="flex bg-slate-50 p-1.5 m-6 mb-0 rounded-2xl border border-slate-200 shrink-0">
          {(['manual', 'bibtex', 'bulk', 'csv', 'share'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`flex-1 flex items-center justify-center space-x-2 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${mode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {m === 'manual' ? <FileText size={16} /> : m === 'bibtex' ? <Database size={16} /> : m === 'bulk' ? <List size={16} /> : m === 'csv' ? <FileSpreadsheet size={16} /> : <Share2 size={16} />}
              <span>{m}</span>
            </button>
          ))}
        </div>

        <div className="px-8 py-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className="mb-6">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Target Collection</label>
            <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold" value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)}>
              <option value="">Unfiled</option>
              {folders.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
          </div>

          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sources</label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input required placeholder="DOI or URL" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm" value={manualPaper.url} onChange={e => setManualPaper({ ...manualPaper, url: e.target.value })} />
                      </div>
                      <button type="button" onClick={handleFetchMetadata} disabled={fetchingMetadata} className="px-4 bg-blue-100 text-blue-600 rounded-xl font-bold text-xs uppercase hover:bg-blue-200 transition-colors">
                        {fetchingMetadata ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                      </button>
                    </div>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input placeholder="DOI (e.g. 10.1038/nature12345)" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm" value={manualPaper.doi} onChange={e => setManualPaper({ ...manualPaper, doi: e.target.value })} />
                    </div>
                    <input placeholder="PDF Direct Link" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm" value={manualPaper.pdf_link} onChange={e => setManualPaper({ ...manualPaper, pdf_link: e.target.value })} />
                    <input required placeholder="Resource Title" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold" value={manualPaper.title} onChange={e => setManualPaper({ ...manualPaper, title: e.target.value })} />
                    <input placeholder="Authors" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm" value={manualPaper.authors} onChange={e => setManualPaper({ ...manualPaper, authors: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Classification Label" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm font-black text-blue-600 uppercase" value={manualPaper.userLabel} onChange={e => setManualPaper({ ...manualPaper, userLabel: e.target.value })} />
                    <div className="flex space-x-1 py-1">
                      {[1, 2, 3, 4, 5].map(s => <button key={s} type="button" onClick={() => setManualPaper({ ...manualPaper, importance: s })}><Star size={20} className={s <= manualPaper.importance ? "fill-amber-400 text-amber-400" : "text-slate-200"} /></button>)}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Abstract</label>
                  <textarea rows={10} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm leading-relaxed resize-none" value={manualPaper.abstract} onChange={e => setManualPaper({ ...manualPaper, abstract: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <textarea rows={3} placeholder="Summary" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm resize-none" value={manualPaper.summary} onChange={e => setManualPaper({ ...manualPaper, summary: e.target.value })} />
                  <textarea rows={3} placeholder="Critical Evaluation" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm resize-none" value={manualPaper.critical_evaluation} onChange={e => setManualPaper({ ...manualPaper, critical_evaluation: e.target.value })} />
                </div>
                <div className="space-y-4">
                  <textarea rows={3} placeholder="Remarks" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm resize-none" value={manualPaper.remarks} onChange={e => setManualPaper({ ...manualPaper, remarks: e.target.value })} />
                  <textarea rows={3} placeholder="Useful Snippet" className="w-full bg-blue-50 border-2 border-blue-100 rounded-xl px-4 py-2.5 text-sm resize-none italic" value={manualPaper.useful_snippet} onChange={e => setManualPaper({ ...manualPaper, useful_snippet: e.target.value })} />
                </div>
              </div>
              <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-xl shadow-blue-100 transition-all uppercase tracking-widest active:scale-[0.98]">
                {loading ? <Loader2 className="animate-spin mx-auto" /> : "Save Resource"}
              </button>
            </form>
          )}

          {mode === 'bibtex' && (
            <div className="space-y-6">
              <textarea placeholder="@article{...}" className="w-full h-80 p-5 bg-slate-900 text-blue-300 font-mono text-xs rounded-2xl" value={bibtexInput} onChange={e => setBibtexInput(e.target.value)} />
              <button onClick={handleBibtexImport} disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-xl shadow-blue-100">Parse & Import</button>
            </div>
          )}

          {mode === 'bulk' && (
            <div className="space-y-6">
              <textarea placeholder="Paste links (one per line)..." className="w-full h-80 p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl" value={bulkInput} onChange={e => setBulkInput(e.target.value)} />
              <button onClick={handleBulkImport} disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-xl shadow-blue-100">Bulk Import</button>
            </div>
          )}

          {mode === 'csv' && (
            <div className="space-y-8 py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50">
              <div className="p-6 bg-white rounded-3xl shadow-sm">
                <FileSpreadsheet size={48} className="text-blue-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-slate-800">Import CSV Library</h3>
                <p className="text-slate-400 text-sm max-w-sm px-10">Upload a CSV file containing headers like: title, authors, doi, url, summary, etc.</p>
              </div>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleCSVFile}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex items-center space-x-3 px-8 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200 uppercase tracking-widest text-sm"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
                <span>Choose CSV File</span>
              </button>
            </div>
          )}

          {mode === 'share' && (
            <div className="space-y-8 py-10 flex flex-col items-center justify-center border-2 border-dashed border-blue-200 rounded-[2.5rem] bg-blue-50">
              <div className="p-6 bg-white rounded-3xl shadow-sm">
                <Share2 size={48} className="text-blue-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-slate-800">Import from Share Link</h3>
                <p className="text-slate-500 text-sm max-w-md px-10">Paste a share link URL or share ID to import papers from a shared collection</p>
              </div>
              <div className="w-full max-w-lg space-y-4">
                <input
                  type="text"
                  placeholder="Paste share link URL or share ID..."
                  className="w-full bg-white border-2 border-blue-200 rounded-2xl px-6 py-4 text-sm font-mono text-center"
                  value={shareInput}
                  onChange={(e) => setShareInput(e.target.value)}
                />
                <button
                  onClick={handleShareLinkImport}
                  disabled={loading || !shareInput.trim()}
                  className="w-full flex items-center justify-center space-x-3 px-8 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Share2 size={20} />}
                  <span>{loading ? 'Importing...' : 'Import Papers'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddResourceModal;
