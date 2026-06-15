import React from 'react';
import { X as CloseIcon, Folder as FolderIcon, Settings, Info } from 'lucide-react';
import { Folder, Paper } from '../types';

interface ManageCollectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  papers: Paper[];
}

const ManageCollectionsModal: React.FC<ManageCollectionsModalProps> = ({ isOpen, onClose, folders, papers }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Settings size={24} /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Library Folders</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Sheet Tabs</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-xl">
            <CloseIcon size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Connected Folders ({folders.length})</h3>
            <div className="divide-y divide-slate-50 border border-slate-100 rounded-3xl p-4 bg-slate-50/50">
              {folders.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-bold italic text-sm">No folder tabs found.</div>
              ) : (
                folders.map(folder => {
                  const paperCount = papers.filter(p => p.folder_id === folder.id).length;
                  return (
                    <div key={folder.id} className="py-4 first:pt-2 last:pb-2 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FolderIcon size={18} className="text-blue-400" />
                        <span className="text-sm font-black text-slate-700">{folder.name}</span>
                      </div>
                      <span className="bg-blue-100 text-blue-700 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
                        {paperCount} {paperCount === 1 ? 'paper' : 'papers'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="p-8 bg-blue-50 border-t border-slate-100 shrink-0 flex items-start space-x-3">
          <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-700 font-bold leading-relaxed">
            Folders correspond to individual tabs in your Google Spreadsheet. To add, rename, or delete folders, manage the tabs directly inside Google Sheets and refresh the application.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ManageCollectionsModal;
