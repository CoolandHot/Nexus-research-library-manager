
import React, { useState } from 'react';
import { X, Folder, Plus, Edit3, Trash2, ChevronRight, Settings, AlertTriangle, Save } from 'lucide-react';
import { Folder as FolderType, Paper, Profile } from '../types';
import { getLibraryClient } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

interface ManageCollectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderType[];
  papers: Paper[];
  profile: Profile;
}

const ManageCollectionsModal: React.FC<ManageCollectionsModalProps> = ({ isOpen, onClose, folders, papers, profile }) => {
  const queryClient = useQueryClient();

  const [newFolderName, setNewFolderName] = useState('');
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    const libraryClient = getLibraryClient();
    if (!newFolderName.trim() || !libraryClient) return;
    setLoading(true);
    try {
      const { error } = await libraryClient.from('folders').insert({
        name: newFolderName.trim(),
        parent_id: parentFolderId || null
      });
      if (!error) {
        setNewFolderName('');
        setParentFolderId(null);
        await queryClient.invalidateQueries({ queryKey: ['library', profile.id] });
      } else {
        alert("Failed to create folder: " + error.message);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (id: string) => {
    const libraryClient = getLibraryClient();
    if (!editName.trim() || !libraryClient) return;
    setLoading(true);
    try {
      const { error } = await libraryClient.from('folders').update({ name: editName.trim() }).eq('id', id);
      if (!error) {
        setEditingFolderId(null);
        await queryClient.invalidateQueries({ queryKey: ['library', profile.id] });
      } else {
        alert("Failed to rename folder: " + error.message);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    console.log("[Collections] Delete button triggered for folder:", id);
    const libraryClient = getLibraryClient();
    if (!libraryClient) {
      console.error("[Collections] Library client missing");
      return;
    }

    const paperCount = papers.filter(p => p.folder_id === id).length;
    const childCount = folders.filter(f => f.parent_id === id).length;

    let confirmMsg = "Permanently delete this collection?";
    if (paperCount > 0 || childCount > 0) {
      confirmMsg = `This folder contains ${paperCount} papers and ${childCount} child folders. Deleting it will unfile the papers and delete child folders. Proceed?`;
    }

    const confirmed = window.confirm(confirmMsg);
    console.log("[Collections] Confirmation result for folder delete:", confirmed);

    if (!confirmed) return;

    setLoading(true);

    // Execute async deletion after confirmation
    (async () => {
      try {
        const { error } = await libraryClient.from('folders').delete().eq('id', id);
        if (!error) {
          console.log("[Collections] Folder deleted successfully");
          await queryClient.invalidateQueries({ queryKey: ['library', profile.id] });
        } else {
          console.error("[Collections] Supabase folder delete error:", error);
          alert("Failed to delete folder: " + error.message);
        }
      } catch (err: any) {
        console.error("[Collections] Delete folder exception:", err);
        alert("Error: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Settings size={24} /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Manage Collections</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Organize recursive structure</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-xl">
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">New Collection</h3>
            <div className="flex flex-col space-y-3">
              <input
                placeholder="Collection name..."
                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-all"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
              />
              <div className="flex space-x-3">
                <select
                  className="flex-1 bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold"
                  value={parentFolderId || ''}
                  onChange={e => setParentFolderId(e.target.value || null)}
                >
                  <option value="">Top Level (Root)</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <button
                  onClick={handleCreate}
                  disabled={loading || !newFolderName.trim()}
                  className="px-8 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-100 disabled:bg-slate-300 disabled:shadow-none uppercase tracking-widest text-[10px]"
                >
                  {loading ? "..." : "Create"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Existing Collections ({folders.length})</h3>
            <div className="divide-y divide-slate-50">
              {folders.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-bold italic text-sm">No folders created yet.</div>
              ) : (
                folders.map(folder => (
                  <div key={folder.id} className="py-4 group">
                    <div className="flex items-center justify-between">
                      {editingFolderId === folder.id ? (
                        <div className="flex-1 flex items-center space-x-2">
                          <input
                            className="flex-1 bg-slate-50 border-2 border-blue-200 rounded-xl px-4 py-2 text-sm font-bold"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => handleRename(folder.id)} className="p-2 bg-emerald-500 text-white rounded-xl" title="Save"><Save size={16} /></button>
                          <button onClick={() => setEditingFolderId(null)} className="p-2 bg-slate-200 text-slate-600 rounded-xl" title="Cancel"><X size={16} /></button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-3">
                            <Folder size={18} className="text-blue-400" />
                            <div>
                              <p className="text-sm font-black text-slate-700">{folder.name}</p>
                              {folder.parent_id && (
                                <p className="text-[9px] font-bold text-slate-400 flex items-center space-x-1">
                                  <span>Sub-folder of</span>
                                  <ChevronRight size={8} />
                                  <span>{folders.find(f => f.id === folder.parent_id)?.name}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingFolderId(folder.id); setEditName(folder.name); }}
                              className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                              title="Rename Collection"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(folder.id)}
                              className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                              title="Delete Collection"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0 flex items-start space-x-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
            Folders organize your database logically. Deleting a parent folder will automatically reassign its contents to the Root (Unfiled) level unless they are part of a cascading deletion.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ManageCollectionsModal;
