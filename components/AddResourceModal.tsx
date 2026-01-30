
import React, { useState, useRef } from 'react';
import { X, FileText, Globe, List, Loader2, Save, Database, Plus, Star, Tag, Upload, FileSpreadsheet, Hash, Share2, AlertTriangle } from 'lucide-react';
import { Folder, PaperType } from '../types';
import { fetchCrossRefMetadata, parseBibTeX } from '../lib/metadata';
import { authSupabase } from '../lib/supabase';

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  papers?: any[]; // Existing papers for duplicate detection
  onAdd: (papers: any[]) => Promise<void>;
  initialMode?: 'manual' | 'bibtex' | 'bulk' | 'csv' | 'share';
  initialFolderId?: string | null;
}

const AddResourceModal: React.FC<AddResourceModalProps> = ({ isOpen, onClose, folders, papers = [], onAdd, initialMode = 'manual', initialFolderId = null }) => {
  const [mode, setMode] = useState<'manual' | 'bibtex' | 'bulk' | 'csv' | 'share'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>(initialFolderId || '');

  // Update selected folder when initialFolderId changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedFolder(initialFolderId || '');
    }
  }, [isOpen, initialFolderId]);
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
  const [duplicateDialog, setDuplicateDialog] = useState<{ isOpen: boolean; existingPaper: any | null }>({
    isOpen: false,
    existingPaper: null
  });
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

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

  const handleManualSubmit = async (e: React.FormEvent, bypassDuplicateCheck = false) => {
    e.preventDefault();

    // Check for duplicate DOI if not bypassed
    if (!bypassDuplicateCheck && manualPaper.doi && manualPaper.doi.trim()) {
      const existingPaper = papers.find(p => p.doi && p.doi.toLowerCase() === manualPaper.doi.toLowerCase());
      if (existingPaper) {
        setDuplicateDialog({
          isOpen: true,
          existingPaper
        });
        return; // Stop here and show dialog
      }
    }

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
    const lines = bulkInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    setLoading(true);
    setBulkProgress({ current: 0, total: lines.length });

    const results: any[] = [];

    try {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        setBulkProgress({ current: i + 1, total: lines.length });

        // Check if it's a DOI or doi.org URL
        const isDoi = line.includes('doi.org/') || line.startsWith('10.') || /10.\d{4,9}\/[-._;()/:A-Z0-9]+/i.test(line);

        let paperData: any = null;
        if (isDoi) {
          paperData = await fetchCrossRefMetadata(line);
        }

        if (paperData) {
          results.push({
            ...paperData,
            folder_id: selectedFolder || null
          });
        } else if (line.startsWith('http')) {
          // Fallback to simple URL logic if not a DOI or CrossRef fetch failed
          results.push({
            url: line,
            title: line.split('/').pop()?.split('?')[0] || 'Untitled Resource',
            type: (line.toLowerCase().endsWith('.pdf') ? 'pdf' : 'web') as PaperType,
            folder_id: selectedFolder || null
          });
        }

        // Wait at least 1 second before next request (if not the last line)
        if (i < lines.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (results.length > 0) {
        await onAdd(results);
        onClose();
      } else {
        alert("No papers could be imported.");
      }
    } catch (e: any) {
      console.error("Bulk import failed", e);
      alert("Bulk import failed: " + e.message);
    } finally {
      setLoading(false);
      setBulkProgress(null);
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
            const val = parts[i] || '';
            const unescapedVal = val.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
            if (h === 'user_label') paper.user_label = unescapedVal;
            else if (h === 'pdf_link') paper.pdf_link = unescapedVal;
            else if (h === 'published_year') paper.published_year = unescapedVal;
            else if (h === 'importance') paper.importance = parseInt(unescapedVal) || 0;
            else if (['title', 'authors', 'doi', 'url', 'summary', 'abstract', 'critical_evaluation', 'remarks', 'useful_snippet'].includes(h)) {
              paper[h] = unescapedVal;
            }
          });

          // Ensure url is never null/empty (database constraint)
          if (!paper.url || !paper.url.trim()) {
            paper.url = paper.doi ? `https://doi.org/${paper.doi}` : 'https://example.com/no-url-provided';
          }

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
          user_label: userLabel || p.user_label, // Support both naming conventions
          url: p.url || (p.doi ? `https://doi.org/${p.doi}` : 'https://example.com/no-url-provided')
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
              <textarea
                placeholder="Paste links or DOIs (one per line)..."
                className="w-full h-80 p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl resize-none"
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                disabled={loading}
              />

              {bulkProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    <span>Fetching Metadata...</span>
                    <span>{bulkProgress.current} / {bulkProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-500"
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleBulkImport}
                disabled={loading || !bulkInput.trim()}
                className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-xl shadow-blue-100 flex items-center justify-center space-x-2 disabled:bg-slate-300 disabled:shadow-none transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Database size={20} />}
                <span>{loading ? 'Processing...' : 'Bulk Import'}</span>
              </button>
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

      {/* Duplicate Detection Dialog */}
      {duplicateDialog.isOpen && duplicateDialog.existingPaper && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-orange-200">
            <div className="flex items-start space-x-4 mb-6">
              <div className="p-3 bg-orange-100 rounded-2xl">
                <AlertTriangle size={24} className="text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-900 mb-2">Duplicate DOI Detected</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  A paper with this DOI already exists in your library.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Existing Paper</p>
              <p className="text-sm font-bold text-slate-900">{duplicateDialog.existingPaper.title}</p>
              <p className="text-xs text-slate-500">DOI: {duplicateDialog.existingPaper.doi}</p>
              {duplicateDialog.existingPaper.folder_id && (
                <p className="text-xs text-blue-600">
                  📁 {folders.find(f => f.id === duplicateDialog.existingPaper.folder_id)?.name || 'Unknown folder'}
                </p>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setDuplicateDialog({ isOpen: false, existingPaper: null })}
                className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  setDuplicateDialog({ isOpen: false, existingPaper: null });
                  handleManualSubmit(e as any, true);
                }}
                className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-orange-100"
              >
                Add Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddResourceModal;
