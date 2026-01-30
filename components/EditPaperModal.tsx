
import React, { useState, useEffect } from 'react';
// Added Edit3 to the lucide-react imports
import { X, Save, FileText, Star, Tag, Info, BookOpen, Quote, MessageCircle, Edit3 } from 'lucide-react';
import { Paper, Folder } from '../types';

interface EditPaperModalProps {
  isOpen: boolean;
  paper: Paper;
  folders: Folder[];
  onClose: () => void;
  onUpdate: (updated: Partial<Paper>) => void;
}

const EditPaperModal: React.FC<EditPaperModalProps> = ({ isOpen, paper, folders, onClose, onUpdate }) => {
  const [formData, setFormData] = useState<Partial<Paper>>({});

  useEffect(() => {
    if (paper) {
      setFormData({
        id: paper.id,
        title: paper.title,
        authors: paper.authors,
        published_year: paper.published_year,
        doi: paper.doi,
        url: paper.url,
        pdf_link: paper.pdf_link,
        userLabel: paper.userLabel,
        importance: paper.importance,
        summary: paper.summary,
        abstract: paper.abstract,
        critical_evaluation: paper.critical_evaluation,
        remarks: paper.remarks,
        useful_snippet: paper.useful_snippet,
        folder_id: paper.folder_id
      });
    }
  }, [paper]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
    onClose();
  };

  const handleChange = (field: keyof Paper, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Edit3 className="w-6 h-6" /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Edit Research Entry</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Update metadata and insights</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-xl">
            <X size={28} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Identity & Source */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Identity & Location</h3>
                <div className="space-y-3">
                  <input 
                    required 
                    placeholder="Title" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black text-slate-800 outline-none focus:border-blue-500 transition-all"
                    value={formData.title || ''}
                    onChange={e => handleChange('title', e.target.value)}
                  />
                  <input 
                    placeholder="Authors" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-600"
                    value={formData.authors || ''}
                    onChange={e => handleChange('authors', e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      placeholder="Year" 
                      className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold"
                      value={formData.published_year || ''}
                      onChange={e => handleChange('published_year', e.target.value)}
                    />
                    <input 
                      placeholder="DOI" 
                      className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold"
                      value={formData.doi || ''}
                      onChange={e => handleChange('doi', e.target.value)}
                    />
                  </div>
                  <input 
                    placeholder="Resource URL" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm"
                    value={formData.url || ''}
                    onChange={e => handleChange('url', e.target.value)}
                  />
                  <input 
                    placeholder="PDF Link" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm"
                    value={formData.pdf_link || ''}
                    onChange={e => handleChange('pdf_link', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Classification</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    placeholder="Label (e.g. AI, Physics)" 
                    className="bg-blue-50 border-2 border-blue-100 rounded-2xl px-5 py-3 text-sm font-black text-blue-600 uppercase"
                    value={formData.userLabel || ''}
                    onChange={e => handleChange('userLabel', e.target.value)}
                  />
                  <div className="flex items-center justify-center space-x-1 bg-slate-50 rounded-2xl border-2 border-slate-100">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button" onClick={() => handleChange('importance', s)}>
                        <Star size={20} className={s <= (formData.importance || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                      </button>
                    ))}
                  </div>
                </div>
                <select 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold"
                  value={formData.folder_id || ''}
                  onChange={e => handleChange('folder_id', e.target.value || null)}
                >
                  <option value="">Unfiled</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>

            {/* Insights */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">The Essentials</h3>
                <textarea 
                  rows={8} 
                  placeholder="Abstract" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-4 text-sm leading-relaxed resize-none font-medium"
                  value={formData.abstract || ''}
                  onChange={e => handleChange('abstract', e.target.value)}
                />
                <textarea 
                  rows={5} 
                  placeholder="Summary / Remarks" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-4 text-sm leading-relaxed resize-none font-medium text-slate-600"
                  value={formData.summary || ''}
                  onChange={e => handleChange('summary', e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Critical Depth</h3>
                <textarea 
                  rows={4} 
                  placeholder="Critical Evaluation" 
                  className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-3xl px-6 py-4 text-sm leading-relaxed resize-none font-bold text-emerald-800"
                  value={formData.critical_evaluation || ''}
                  onChange={e => handleChange('critical_evaluation', e.target.value)}
                />
                <textarea 
                  rows={3} 
                  placeholder="Useful Evidence Snippet" 
                  className="w-full bg-blue-600 rounded-3xl px-6 py-4 text-sm leading-relaxed resize-none font-black text-white italic placeholder:text-blue-300"
                  value={formData.useful_snippet || ''}
                  onChange={e => handleChange('useful_snippet', e.target.value)}
                />
              </div>
            </div>
          </div>
        </form>

        <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-end space-x-4">
          <button onClick={onClose} className="px-8 py-4 text-sm font-black text-slate-400 uppercase tracking-widest">Cancel</button>
          <button 
            onClick={handleSubmit}
            className="flex items-center space-x-3 px-12 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase tracking-widest text-sm"
          >
            <Save size={20} />
            <span>Update Entry</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPaperModal;
