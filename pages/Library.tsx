
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Settings as SettingsIcon, Database, FileText, User,
  ChevronDown, Edit3, Trash2, Globe, Star, Tag, AlertTriangle,
  BookOpen, Calendar, Hash, X as CloseIcon, Info, LogOut, Download, CheckSquare, Square, Share2, FolderPlus, Folder as FolderIcon, Move, Menu, PanelLeftClose, PanelLeftOpen, Link as LinkIcon, FileDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { authSupabase, getLibraryClient } from '../lib/supabase';
import { Folder, Paper, TreeItem, Profile } from '../types';
import TreeNode from '../components/TreeNode';
import AddResourceModal from '../components/AddResourceModal';
import ManageCollectionsModal from '../components/ManageCollectionsModal';
import EditPaperModal from '../components/EditPaperModal';
import ManageShareLinksModal from '../components/ManageShareLinksModal';
import { ConfirmDialog, AlertDialog } from '../components/DialogModals';
import { useNavigate } from 'react-router-dom';
import { downloadBibliography } from '../lib/bibliographyGenerator';
import { formatBibTeX, formatAPA, formatRIS, copyCitation } from '../lib/citationFormatters';

interface LibraryProps {
  profile: Profile;
  onLogout: () => void;
}

const Library: React.FC<LibraryProps> = ({ profile, onLogout }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageFoldersOpen, setIsManageFoldersOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isManageShareLinksOpen, setIsManageShareLinksOpen] = useState(false);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [shareLinkTitle, setShareLinkTitle] = useState('');
  const [shareLinkDescription, setShareLinkDescription] = useState('');

  // Dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { }, variant: 'info' });

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'success' | 'error' | 'info';
  }>({ isOpen: false, title: '', message: '', variant: 'info' });

  // Copy feedback state
  const [copiedFormat, setCopiedFormat] = useState<{ paperId: string, format: string } | null>(null);

  // Column Resizing State
  const [columnWidths, setColumnWidths] = useState({
    selection: 60,
    identity: 600,
    classification: 180,
    abstract: 300,
    summary: 300,
    evaluation: 300,
    remarks: 250,
    snippet: 250,
    copyAs: 180,
    actions: 120
  });

  const resizingRef = useRef<{ col: keyof typeof columnWidths, startX: number, startWidth: number } | null>(null);

  const startResizing = useCallback((col: keyof typeof columnWidths, e: React.MouseEvent) => {
    resizingRef.current = {
      col,
      startX: e.pageX,
      startWidth: columnWidths[col]
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { col, startX, startWidth } = resizingRef.current;
      const delta = e.pageX - startX;
      setColumnWidths(prev => ({
        ...prev,
        [col]: Math.max(50, startWidth + delta)
      }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const libraryClient = getLibraryClient();

  const { data: libraryData, isLoading, error: queryError } = useQuery({
    queryKey: ['library', profile.id],
    queryFn: async () => {
      console.log("[Library] Fetching library data...");
      const client = getLibraryClient();
      if (!client) throw new Error('Library client not initialized');
      const [foldersRes, papersRes] = await Promise.all([
        client.from('folders').select('*'),
        client.from('papers').select('*').order('created_at', { ascending: false }),
      ]);
      if (foldersRes.error) {
        console.error("[Library] Folders fetch error:", foldersRes.error);
        throw foldersRes.error;
      }
      if (papersRes.error) {
        console.error("[Library] Papers fetch error:", papersRes.error);
        throw papersRes.error;
      }

      return {
        folders: (foldersRes.data || []) as Folder[],
        papers: (papersRes.data || []).map((p: any) => ({
          ...p,
          userLabel: p.user_label,
          critical_evaluation: p.critical_evaluation,
          useful_snippet: p.useful_snippet
        })) as Paper[]
      };
    },
    enabled: !!libraryClient
  });

  const updatePaperMutation = useMutation({
    mutationFn: async (paper: Partial<Paper>) => {
      console.log("[Library] Attempting to update paper:", paper.id);
      const client = getLibraryClient();
      if (!client || !paper.id) throw new Error("Library client disconnected or missing ID");

      const { id, userLabel, critical_evaluation, useful_snippet, ...rest } = paper;
      const dbPayload: any = {
        title: rest.title,
        url: rest.url,
        pdf_link: rest.pdf_link,
        doi: rest.doi,
        authors: rest.authors,
        published_year: rest.published_year,
        summary: rest.summary,
        abstract: rest.abstract,
        remarks: rest.remarks,
        importance: rest.importance,
        folder_id: rest.folder_id,
        user_label: userLabel,
        critical_evaluation: critical_evaluation,
        useful_snippet: useful_snippet
      };

      Object.keys(dbPayload).forEach(key => dbPayload[key] === undefined && delete dbPayload[key]);

      const { data, error } = await client.from('papers').update(dbPayload).eq('id', id).select();

      if (error) {
        console.error("[Library] Paper update error:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', profile.id] });
      setEditingPaper(null);
    },
    onError: (err: any) => {
      console.error("[Library] updatePaperMutation error:", err);
      alert("Failed to update: " + err.message);
    }
  });

  const deletePaperMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("[Library] Starting delete operation for ID:", id);
      const client = getLibraryClient();
      if (!client) throw new Error("Library disconnected");

      const { error } = await client.from('papers').delete().eq('id', id);
      if (error) {
        console.error("[Library] Supabase delete error:", error);
        throw error;
      }
      console.log("[Library] Delete successful for ID:", id);
      return id;
    },
    onSuccess: (deletedId) => {
      console.log("[Library] Invalidating cache after delete...");
      queryClient.invalidateQueries({ queryKey: ['library', profile.id] });
      setSelectedPaperIds(prev => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
    },
    onError: (err: any) => {
      console.error("[Library] Delete mutation failed:", err);
      alert("Delete failed: " + err.message);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      console.log("[Library] Bulk deleting papers:", ids);
      const client = getLibraryClient();
      if (!client) throw new Error("Library disconnected");
      const { error } = await client.from('papers').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', profile.id] });
      setSelectedPaperIds(new Set());
    },
    onError: (err: any) => {
      alert("Bulk delete failed: " + err.message);
    }
  });

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ ids, folderId }: { ids: string[], folderId: string | null }) => {
      const client = getLibraryClient();
      if (!client) throw new Error("Library disconnected");
      const { error } = await client.from('papers').update({ folder_id: folderId }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', profile.id] });
      setSelectedPaperIds(new Set());
      setIsMoving(false);
    },
    onError: (err: any) => {
      alert("Bulk move failed: " + err.message);
    }
  });

  const tree = useMemo(() => {
    if (!libraryData) return [];
    const buildTree = (parentId: string | null = null): TreeItem[] => {
      return (libraryData.folders || [])
        .filter(f => f.parent_id === parentId)
        .map(f => ({
          ...f,
          children: buildTree(f.id),
          papers: (libraryData.papers || []).filter(p => p.folder_id === f.id),
        }));
    };
    const unfiledPapers: TreeItem = { id: 'unfiled', name: 'Unfiled', parent_id: null, children: [], papers: (libraryData.papers || []).filter(p => !p.folder_id) };
    return [unfiledPapers, ...buildTree(null)];
  }, [libraryData]);

  const activePapers = useMemo(() => {
    if (!libraryData) return [];
    const filtered = activeFolderId
      ? libraryData.papers.filter(p => p.folder_id === activeFolderId)
      : libraryData.papers;

    if (!searchQuery) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.authors?.toLowerCase().includes(q) ||
      (p.userLabel || '').toLowerCase().includes(q)
    );
  }, [activeFolderId, libraryData, searchQuery]);

  const toggleSelection = (id: string) => {
    setSelectedPaperIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedPaperIds.size === activePapers.length && activePapers.length > 0) {
      setSelectedPaperIds(new Set());
    } else {
      setSelectedPaperIds(new Set(activePapers.map(p => p.id)));
    }
  };

  const handleBulkDelete = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Papers',
      message: `Are you sure you want to permanently delete these ${selectedPaperIds.size} entries? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: () => {
        bulkDeleteMutation.mutate(Array.from(selectedPaperIds));
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { }, variant: 'info' });
      },
      onCancel: () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { }, variant: 'info' })
    });
  };

  const handleCreateShareLink = async () => {
    if (!shareLinkTitle.trim()) {
      setAlertDialog({
        isOpen: true,
        title: 'Missing Title',
        message: 'Please enter a title for the share link',
        variant: 'error'
      });
      return;
    }

    try {
      // Share links are stored in global database, not personal library
      if (!authSupabase) {
        setAlertDialog({
          isOpen: true,
          title: 'Connection Error',
          message: 'Unable to connect to database.',
          variant: 'error'
        });
        return;
      }

      const shareId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      // Get full paper data for selected IDs
      const papersToShare = activePapers.filter(p => selectedPaperIds.has(p.id));

      const { error } = await authSupabase.from('share_links').insert({
        share_id: shareId,
        title: shareLinkTitle.trim(),
        description: shareLinkDescription.trim() || null,
        papers: papersToShare,  // Store full paper objects as JSON
        created_by: profile.id
      });
      if (error) throw error;

      const shareUrl = `${window.location.origin}/#/share/${shareId}`;
      await navigator.clipboard.writeText(shareUrl);

      // Invalidate share links query to refresh the manage modal
      queryClient.invalidateQueries({ queryKey: ['share_links', profile.id] });

      setAlertDialog({
        isOpen: true,
        title: 'Share Link Created',
        message: `Share link created successfully and copied to clipboard!\n\n${shareUrl}`,
        variant: 'success'
      });

      setIsCreatingShareLink(false);
      setShareLinkTitle('');
      setShareLinkDescription('');
      setSelectedPaperIds(new Set());
    } catch (err: any) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to create share link: ' + err.message,
        variant: 'error'
      });
    }
  };

  const handleGenerateBibliography = () => {
    const papersToExport = activePapers.filter(p => selectedPaperIds.has(p.id));
    if (papersToExport.length === 0) {
      setAlertDialog({
        isOpen: true,
        title: 'No Papers Selected',
        message: 'Please select papers to generate bibliography first.',
        variant: 'error'
      });
      return;
    }

    downloadBibliography(papersToExport, 'nexus_bibliography');
    setAlertDialog({
      isOpen: true,
      title: 'Bibliography Generated',
      message: `Annotated bibliography generated with ${papersToExport.length} entries!`,
      variant: 'success'
    });
  };

  const exportToCSV = () => {
    const papersToExport = activePapers.filter(p => selectedPaperIds.has(p.id));
    if (papersToExport.length === 0) {
      alert("Select papers to export first.");
      return;
    }

    const headers = [
      'title', 'authors', 'published_year', 'doi', 'url', 'pdf_link',
      'user_label', 'importance', 'summary', 'abstract',
      'critical_evaluation', 'remarks', 'useful_snippet'
    ];

    const csvRows = [
      headers.join(','),
      ...papersToExport.map(p => {
        return headers.map(header => {
          const val = (p as any)[header === 'user_label' ? 'userLabel' : header] || '';
          // Escape quotes first as per CSV standard, then escape newlines to keep data on one line
          const escaped = ('' + val)
            .replace(/"/g, '""')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
          return `"${escaped}"`;
        }).join(',');
      })
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `nexus_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const MarkdownRenderer: React.FC<{ content: string | undefined, className?: string }> = ({ content, className = '' }) => {
    if (!content) return <span className={className}>—</span>;
    return (
      <div className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
            strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
            em: ({ node, ...props }) => <em className="italic" {...props} />,
            ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2" {...props} />,
            ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2" {...props} />,
            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (queryError) return (
    <div className="flex flex-col items-center justify-center h-screen bg-red-50 p-10 text-center">
      <AlertTriangle size={48} className="text-red-600 mb-4" />
      <h2 className="text-2xl font-black text-red-900 mb-2">Library Connection Failed</h2>
      <p className="text-red-600 mb-8 max-w-md font-bold">Could not reach your personal database. Your connection keys may be invalid or the project paused.</p>
      <button onClick={() => navigate('/setup')} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-100">Update Credentials</button>
    </div>
  );

  const totalWidth = Object.values(columnWidths).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <aside className={`bg-white border-r border-slate-200 flex flex-col z-20 shrink-0 transition-all duration-300 ${isSidebarVisible ? 'w-72' : 'w-0 border-r-0 overflow-hidden'}`}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => setActiveFolderId(null)}>
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold italic shadow-lg shadow-blue-200">N</div>
            <span className="font-extrabold text-slate-800 tracking-tight text-lg">Nexus</span>
          </div>
          <button
            onClick={() => setIsManageFoldersOpen(true)}
            className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-xl transition-all"
            title="Manage Collections"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3 text-slate-400" size={16} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {tree.map(item => (
              <TreeNode
                key={item.id}
                item={item}
                level={0}
                isActive={activeFolderId === (item.id === 'unfiled' ? null : item.id)}
                onSelectFolder={setActiveFolderId}
                onDropPaper={(pid, fid) => updatePaperMutation.mutate({ id: pid, folder_id: fid })}
              />
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-100">
          <button onClick={() => setIsModalOpen(true)} className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 uppercase tracking-widest">
            <Plus size={16} />
            <span>Add Paper</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col bg-white">
        <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <button
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            className="mr-4 p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 hover:text-slate-900"
            title={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
          >
            {isSidebarVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
          <div className="flex items-center space-x-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeFolderId ? libraryData?.folders.find(f => f.id === activeFolderId)?.name : "Full Library"}
            </h2>
            {selectedPaperIds.size > 0 && (
              <div className="flex items-center bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-left-2 space-x-4">
                <span className="text-xs font-black text-blue-600 uppercase tracking-widest border-r border-blue-200 pr-4">{selectedPaperIds.size} Selected</span>

                <div className="flex items-center space-x-4">
                  <button onClick={exportToCSV} className="flex items-center space-x-2 text-blue-700 hover:text-blue-900 text-[10px] font-black uppercase tracking-widest transition-colors">
                    <Download size={14} />
                    <span>Export</span>
                  </button>

                  <button
                    onClick={() => setIsCreatingShareLink(true)}
                    className="flex items-center space-x-2 text-green-700 hover:text-green-900 text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    <LinkIcon size={14} />
                    <span>Share</span>
                  </button>

                  <button
                    onClick={handleGenerateBibliography}
                    className="flex items-center space-x-2 text-purple-700 hover:text-purple-900 text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    <FileDown size={14} />
                    <span>Bibliography</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setIsMoving(!isMoving)}
                      className="flex items-center space-x-2 text-blue-700 hover:text-blue-900 text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                      <Move size={14} />
                      <span>Move</span>
                    </button>
                    {isMoving && (
                      <div className="absolute top-full mt-3 left-0 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] p-3 max-h-80 overflow-y-auto custom-scrollbar">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Target Folder</p>
                        <button
                          onClick={() => bulkMoveMutation.mutate({ ids: Array.from(selectedPaperIds), folderId: null })}
                          className="w-full text-left p-3 hover:bg-blue-50 rounded-xl text-xs font-bold flex items-center space-x-3"
                        >
                          <FolderIcon size={14} className="text-slate-400" />
                          <span>Unfiled</span>
                        </button>
                        {libraryData?.folders.map(f => (
                          <button
                            key={f.id}
                            onClick={() => bulkMoveMutation.mutate({ ids: Array.from(selectedPaperIds), folderId: f.id })}
                            className="w-full text-left p-3 hover:bg-blue-50 rounded-xl text-xs font-bold flex items-center space-x-3"
                          >
                            <FolderIcon size={14} className="text-blue-400" />
                            <span>{f.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center space-x-2 text-red-600 hover:text-red-800 text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center space-x-3 p-1.5 px-4 hover:bg-slate-50 rounded-2xl border border-slate-200 transition-all">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-[10px] uppercase">{profile.username.slice(0, 2)}</div>
                <span className="text-sm font-bold text-slate-700">{profile.username}</span>
                <ChevronDown size={14} className={isProfileOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-[110] p-1">
                  <button onClick={() => { navigate('/setup'); setIsProfileOpen(false); }} className="w-full text-left p-3 hover:bg-blue-50 rounded-lg text-sm font-bold flex items-center space-x-3">
                    <Database size={16} />
                    <span>Configuration</span>
                  </button>
                  <button onClick={() => { setIsManageShareLinksOpen(true); setIsProfileOpen(false); }} className="w-full text-left p-3 hover:bg-green-50 rounded-lg text-sm font-bold flex items-center space-x-3 text-green-700">
                    <LinkIcon size={16} />
                    <span>Share Links</span>
                  </button>
                  <button onClick={onLogout} className="w-full text-left p-3 hover:bg-red-50 rounded-lg text-sm font-bold text-red-600 flex items-center space-x-3">
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table
            className="w-full text-left border-collapse table-fixed"
            style={{ width: `${totalWidth}px` }}
          >
            <thead className="sticky top-0 bg-white/95 backdrop-blur z-30 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th
                  className="px-6 py-5 sticky left-0 bg-white z-40 shadow-sm border-r border-slate-50 relative group"
                  style={{ width: columnWidths.selection }}
                >
                  <button onClick={toggleAllSelection} className="text-slate-400 hover:text-blue-500 transition-colors">
                    {selectedPaperIds.size === activePapers.length && activePapers.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                  <div onMouseDown={(e) => startResizing('selection', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" />
                </th>
                <th
                  className="px-10 py-5 sticky left-0 bg-white z-40 shadow-sm relative group"
                  style={{ width: columnWidths.identity, left: columnWidths.selection }}
                >
                  <span>Paper & Identity</span>
                  <div onMouseDown={(e) => startResizing('identity', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" />
                </th>
                <th className="px-6 py-5 relative group" style={{ width: columnWidths.classification }}>
                  <span>Classification</span>
                  <div onMouseDown={(e) => startResizing('classification', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" />
                </th>
                <th className="px-6 py-5 relative group" style={{ width: columnWidths.abstract }}>
                  <span>Abstract</span>
                  <div onMouseDown={(e) => startResizing('abstract', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" />
                </th>
                <th className="px-6 py-5 relative group" style={{ width: columnWidths.summary }}>
                  <span>Summary</span>
                  <div onMouseDown={(e) => startResizing('summary', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" />
                </th>
                <th className="px-6 py-5 relative group" style={{ width: columnWidths.evaluation }}>
                  <span>Critical Evaluation</span>
                  <div onMouseDown={(e) => startResizing('evaluation', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" />
                </th>
                <th className="px-6 py-5 relative group" style={{ width: columnWidths.remarks }}>
                  <span>Remarks</span>
                  <div onMouseDown={(e) => startResizing('remarks', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" />
                </th>
                <th
                  className="px-6 py-5 relative group"
                  style={{ width: `${columnWidths.snippet}px` }}
                >
                  <div className="flex items-center justify-between">
                    <span>Useful Snippet</span>
                    <div onMouseDown={(e) => startResizing('snippet', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </th>
                <th
                  className="px-6 py-5 relative group"
                  style={{ width: `${columnWidths.copyAs}px` }}
                >
                  <div className="flex items-center justify-between">
                    <span>Copy As</span>
                    <div onMouseDown={(e) => startResizing('copyAs', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </th>
                <th className="px-10 py-5 text-right relative group" style={{ width: columnWidths.actions }}>
                  <span>Actions</span>
                  <div onMouseDown={(e) => startResizing('actions', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activePapers.map(paper => (
                <tr key={paper.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-6 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-20 shadow-sm border-r border-slate-50 text-center">
                    <button onClick={() => toggleSelection(paper.id)} className="text-slate-300 group-hover:text-slate-400 transition-colors">
                      {selectedPaperIds.has(paper.id) ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                    </button>
                  </td>
                  <td
                    className="px-10 py-6 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-20 shadow-sm"
                    style={{ left: columnWidths.selection }}
                  >
                    <div className="flex flex-col space-y-1.5 overflow-hidden">
                      <div className="text-sm font-black text-slate-800 cursor-pointer hover:text-blue-600 leading-tight truncate" onClick={() => window.open(paper.pdf_link || paper.url, '_blank')}>
                        {paper.title}
                      </div>
                      <div className="text-xs text-slate-500 font-medium italic line-clamp-1" title={paper.authors || "Unspecified Author"}>
                        {paper.authors || "Unspecified Author"}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {paper.published_year && (
                          <span className="flex items-center space-x-1 px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase">
                            <Calendar size={8} />
                            <span>{paper.published_year}</span>
                          </span>
                        )}
                        {paper.doi && (
                          <span className="flex items-center space-x-1 px-1.5 py-0.5 bg-blue-50 rounded text-[9px] font-bold text-blue-500 uppercase">
                            <Hash size={8} />
                            <span>{paper.doi}</span>
                          </span>
                        )}
                        {paper.pdf_link && <span className="flex items-center space-x-1 px-1.5 py-0.5 bg-red-50 rounded text-[9px] font-bold text-red-600 uppercase"><FileText size={8} /><span>PDF Attached</span></span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col space-y-2 overflow-hidden">
                      <div className="flex items-center space-x-1 px-2 py-0.5 bg-blue-600 text-white rounded-md text-[9px] font-black uppercase w-fit truncate">
                        <Tag size={10} />
                        <span className="truncate">{paper.userLabel || "Unlabeled"}</span>
                      </div>
                      <div className="flex space-x-0.5">
                        {[1, 2, 3, 4, 5].map(s => <button key={s} onClick={() => updatePaperMutation.mutate({ id: paper.id, importance: s })}><Star size={12} className={s <= (paper.importance || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"} /></button>)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 group/cell relative">
                    <div className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed cursor-help overflow-hidden">
                      <MarkdownRenderer content={paper.abstract} />
                    </div>
                    {paper.abstract && (
                      <div className="absolute left-0 top-full mt-2 hidden group-hover/cell:block z-[100] w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 overflow-hidden">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-50 flex items-center space-x-2">
                          <Info size={12} />
                          <span>Full Abstract</span>
                        </div>
                        <div className="text-xs text-slate-600 leading-relaxed max-h-80 overflow-y-auto custom-scrollbar pr-2">
                          <MarkdownRenderer content={paper.abstract} />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-6 group/cell relative">
                    <div className="text-[11px] text-slate-700 font-bold line-clamp-3 leading-relaxed cursor-help overflow-hidden">
                      <MarkdownRenderer content={paper.summary} />
                    </div>
                    {paper.summary && (
                      <div className="absolute left-0 top-full mt-2 hidden group-hover/cell:block z-[100] w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 overflow-hidden">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-50 flex items-center space-x-2">
                          <BookOpen size={12} />
                          <span>Detailed Summary</span>
                        </div>
                        <div className="text-xs text-slate-700 font-medium leading-relaxed max-h-80 overflow-y-auto custom-scrollbar pr-2">
                          <MarkdownRenderer content={paper.summary} />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-6"><div className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed overflow-hidden"><MarkdownRenderer content={paper.critical_evaluation} /></div></td>
                  <td className="px-6 py-6"><div className="text-[11px] text-slate-400 italic line-clamp-3 leading-relaxed overflow-hidden"><MarkdownRenderer content={paper.remarks} /></div></td>
                  <td className="px-6 py-6"><div className="text-[11px] text-blue-700 font-black line-clamp-3 leading-relaxed overflow-hidden">{paper.useful_snippet ? `"${paper.useful_snippet}"` : "—"}</div></td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col space-y-1">
                      {['BibTeX', 'APA', 'RIS'].map((format) => {
                        const isCopied = copiedFormat?.paperId === paper.id && copiedFormat?.format === format;
                        return (
                          <button
                            key={format}
                            onClick={async () => {
                              let citation = '';
                              if (format === 'BibTeX') citation = formatBibTeX(paper);
                              else if (format === 'APA') citation = formatAPA(paper);
                              else if (format === 'RIS') citation = formatRIS(paper);

                              const success = await copyCitation(citation, format);
                              if (success) {
                                setCopiedFormat({ paperId: paper.id, format });
                                setTimeout(() => setCopiedFormat(null), 2000);
                              }
                            }}
                            className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${isCopied
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
                              }`}
                          >
                            {isCopied ? '✓ Copied' : format}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingPaper(paper)} className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg" title="Edit Entry"><Edit3 size={16} /></button>
                      <button onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Delete Paper',
                          message: `Are you absolutely sure you want to delete "${paper.title}"? This action cannot be undone.`,
                          onConfirm: () => {
                            deletePaperMutation.mutate(paper.id);
                            setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { } });
                          },
                          onCancel: () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { } }),
                          variant: 'danger'
                        });
                      }} className="p-2 hover:bg-red-100 text-red-600 rounded-lg" title="Delete Entry"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <AddResourceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        folders={libraryData?.folders || []}
        papers={libraryData?.papers || []}
        initialFolderId={activeFolderId}
        onAdd={async (papers) => {
          const client = getLibraryClient();
          if (!client) return;
          const { error } = await client.from('papers').insert(papers);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['library', profile.id] });
        }}
      />

      <ManageCollectionsModal
        isOpen={isManageFoldersOpen}
        onClose={() => setIsManageFoldersOpen(false)}
        folders={libraryData?.folders || []}
        papers={libraryData?.papers || []}
        profile={profile}
      />

      {editingPaper && (
        <EditPaperModal
          isOpen={true}
          paper={editingPaper}
          folders={libraryData?.folders || []}
          onClose={() => setEditingPaper(null)}
          onUpdate={(updated) => updatePaperMutation.mutate(updated)}
        />
      )}

      <ManageShareLinksModal
        isOpen={isManageShareLinksOpen}
        onClose={() => setIsManageShareLinksOpen(false)}
        profile={profile}
      />

      {isCreatingShareLink && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCreatingShareLink(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl relative z-10 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                <LinkIcon size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800">Create Share Link</h2>
                <p className="text-xs text-slate-400">Share {selectedPaperIds.size} selected papers</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Title</label>
                <input
                  type="text"
                  value={shareLinkTitle}
                  onChange={(e) => setShareLinkTitle(e.target.value)}
                  placeholder="e.g., Machine Learning Papers"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-green-500 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description (Optional)</label>
                <textarea
                  value={shareLinkDescription}
                  onChange={(e) => setShareLinkDescription(e.target.value)}
                  placeholder="Brief description of this collection..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-green-500 transition-all resize-none"
                  rows={3}
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setIsCreatingShareLink(false)}
                  className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateShareLink}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-green-100"
                >
                  Create Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />

      <AlertDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        variant={alertDialog.variant}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
      />
    </div>
  );
};

export default Library;
