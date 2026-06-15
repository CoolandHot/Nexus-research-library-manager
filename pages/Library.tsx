import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Settings as SettingsIcon, Database, FileText,
  ChevronDown, Edit3, Trash2, Star, Tag, AlertTriangle, AlertCircle, MessageSquare, Quote,
  BookOpen, Calendar, Hash, X as CloseIcon, Info, LogOut, Download, CheckSquare, Square, Folder as FolderIcon, Move, PanelLeftClose, PanelLeftOpen, FileDown,
  ArrowUp, ArrowDown, Library as LibraryIcon
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { 
  signOut, 
  fetchAllPapers, 
  appendPaper, 
  updatePaper, 
  deletePaper, 
  movePaper 
} from '../lib/googleSheets';
import { Folder, Paper, TreeItem } from '../types';
import TreeNode from '../components/TreeNode';
import AddResourceModal from '../components/AddResourceModal';
import ManageCollectionsModal from '../components/ManageCollectionsModal';
import EditPaperModal from '../components/EditPaperModal';
import { ConfirmDialog, AlertDialog } from '../components/DialogModals';
import { useNavigate } from 'react-router-dom';
import { downloadBibliography } from '../lib/bibliographyGenerator';
import { formatBibTeX, formatAPA, formatRIS, copyCitation } from '../lib/citationFormatters';

const Library: React.FC = () => {
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
  const [sortConfig, setSortConfig] = useState<{ key: keyof Paper; direction: 'asc' | 'desc' } | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{
    paperId: string;
    field: string;
    clientX: number;
    clientY: number;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const handleSort = (key: keyof Paper) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

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
    identity: 550,
    abstract: 250,
    summary: 250,
    evaluation: 250,
    remarks: 220,
    snippet: 220,
    copyAs: 150,
    actions: 100
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

  const { data: libraryData, isLoading, error: queryError } = useQuery({
    queryKey: ['library'],
    queryFn: fetchAllPapers
  });

  useEffect(() => {
    if (!activeTooltip) return;

    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const rect = tooltip.getBoundingClientRect();
    const tooltipWidth = activeTooltip.field === 'title' ? 450 : 384;
    const tooltipHeight = rect.height || 250;

    let x = activeTooltip.clientX + 15;
    let y = activeTooltip.clientY + 15;

    if (x + tooltipWidth > window.innerWidth) {
      x = activeTooltip.clientX - tooltipWidth - 15;
    }
    if (y + tooltipHeight > window.innerHeight) {
      y = activeTooltip.clientY - tooltipHeight - 15;
    }

    tooltip.style.left = `${Math.max(10, x)}px`;
    tooltip.style.top = `${Math.max(10, y)}px`;
  }, [activeTooltip]);

  // Clean up hide timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const handleCellMouseEnter = (paperId: string, field: string, e: React.MouseEvent) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    const paper = libraryData?.papers.find(p => p.id === paperId);
    if (!paper) return;

    const value = (paper as any)[
      field === 'title' ? 'title' : 
      field === 'userLabel' ? 'userLabel' : 
      field === 'critical_evaluation' ? 'critical_evaluation' : 
      field === 'useful_snippet' ? 'useful_snippet' : 
      field
    ];
    if (!value) return;

    setActiveTooltip({ 
      paperId, 
      field, 
      clientX: e.clientX, 
      clientY: e.clientY 
    });
  };

  const handleCellMouseLeave = () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = window.setTimeout(() => {
      setActiveTooltip(null);
    }, 200);
  };

  const handleTooltipMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const tooltipPaper = useMemo(() => {
    if (!activeTooltip) return null;
    return libraryData?.papers.find(p => p.id === activeTooltip.paperId);
  }, [activeTooltip, libraryData]);

  const updatePaperMutation = useMutation({
    mutationFn: async (paperUpdate: Partial<Paper> & { id: string }) => {
      console.log("[Library] Attempting to update paper:", paperUpdate.id);
      const currentPapers = libraryData?.papers || [];
      const originalPaper = currentPapers.find(p => p.id === paperUpdate.id);
      if (!originalPaper) throw new Error("Paper not found in local cache");

      const sheetName = originalPaper._sheetName;
      const rowIndex = originalPaper._rowIndex;
      if (!sheetName || rowIndex === undefined) {
        throw new Error("Missing spreadsheet row location info");
      }

      const merged: Paper = {
        ...originalPaper,
        ...paperUpdate,
        critical_evaluation: paperUpdate.critical_evaluation !== undefined ? paperUpdate.critical_evaluation : originalPaper.critical_evaluation,
        useful_snippet: paperUpdate.useful_snippet !== undefined ? paperUpdate.useful_snippet : originalPaper.useful_snippet
      };

      if (paperUpdate.folder_id !== undefined && paperUpdate.folder_id !== originalPaper.folder_id) {
        if (!paperUpdate.folder_id) {
          throw new Error("Cannot move to empty folder in Google Sheets (each tab acts as a folder)");
        }
        await movePaper(sheetName, paperUpdate.folder_id, rowIndex, merged);
      } else {
        await updatePaper(sheetName, rowIndex, merged);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
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
      const currentPapers = libraryData?.papers || [];
      const originalPaper = currentPapers.find(p => p.id === id);
      if (!originalPaper) throw new Error("Paper not found in local cache");

      const sheetName = originalPaper._sheetName;
      const rowIndex = originalPaper._rowIndex;
      if (!sheetName || rowIndex === undefined) {
        throw new Error("Missing spreadsheet row location info");
      }

      await deletePaper(sheetName, rowIndex);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
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
      const currentPapers = libraryData?.papers || [];
      const papersToDelete = currentPapers.filter(p => ids.includes(p.id));

      const bySheet: Record<string, Paper[]> = {};
      papersToDelete.forEach(p => {
        if (p._sheetName && p._rowIndex !== undefined) {
          if (!bySheet[p._sheetName]) bySheet[p._sheetName] = [];
          bySheet[p._sheetName].push(p);
        }
      });

      for (const sheetName of Object.keys(bySheet)) {
        const sorted = bySheet[sheetName].sort((a, b) => (b._rowIndex || 0) - (a._rowIndex || 0));
        for (const paper of sorted) {
          await deletePaper(sheetName, paper._rowIndex!);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      setSelectedPaperIds(new Set());
    },
    onError: (err: any) => {
      alert("Bulk delete failed: " + err.message);
    }
  });

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ ids, folderId }: { ids: string[], folderId: string | null }) => {
      if (!folderId) {
        throw new Error("Cannot move papers to an empty folder (each sheet tab is a folder)");
      }

      const currentPapers = libraryData?.papers || [];
      const papersToMove = currentPapers.filter(p => ids.includes(p.id));

      const bySourceSheet: Record<string, Paper[]> = {};
      papersToMove.forEach(p => {
        if (p._sheetName && p._rowIndex !== undefined) {
          if (!bySourceSheet[p._sheetName]) bySourceSheet[p._sheetName] = [];
          bySourceSheet[p._sheetName].push(p);
        }
      });

      for (const sourceSheet of Object.keys(bySourceSheet)) {
        const sorted = bySourceSheet[sourceSheet].sort((a, b) => (b._rowIndex || 0) - (a._rowIndex || 0));
        for (const paper of sorted) {
          await movePaper(sourceSheet, folderId, paper._rowIndex!, paper);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      setSelectedPaperIds(new Set());
      setIsMoving(false);
    },
    onError: (err: any) => {
      alert("Bulk move failed: " + err.message);
    }
  });

  const tree = useMemo(() => {
    if (!libraryData) return [];
    return libraryData.folders.map(f => ({
      ...f,
      children: [],
      papers: libraryData.papers.filter(p => p.folder_id === f.id)
    })) as TreeItem[];
  }, [libraryData]);

  const activePapers = useMemo(() => {
    if (!libraryData) return [];
    let papers = activeFolderId
      ? libraryData.papers.filter(p => p.folder_id === activeFolderId)
      : libraryData.papers;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      papers = papers.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.authors || '').toLowerCase().includes(q) ||
        (p.abstract || '').toLowerCase().includes(q) ||
        (p.summary || '').toLowerCase().includes(q) ||
        (p.critical_evaluation || '').toLowerCase().includes(q) ||
        (p.remarks || '').toLowerCase().includes(q) ||
        (p.useful_snippet || '').toLowerCase().includes(q) ||
        (p.bibtex || '').toLowerCase().includes(q) ||
        (p.doi || '').toLowerCase().includes(q) ||
        (p.published_year || '').toLowerCase().includes(q) ||
        (p.url || '').toLowerCase().includes(q) ||
        (p.pdf_link || '').toLowerCase().includes(q)
      );
    }

    if (sortConfig) {
      papers = [...papers].sort((a, b) => {
        let aVal: any = a[sortConfig.key];
        let bVal: any = b[sortConfig.key];

        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined || aVal === '') return 1;
        if (bVal === null || bVal === undefined || bVal === '') return -1;

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return papers;
  }, [activeFolderId, libraryData, searchQuery, sortConfig]);

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
      message: `Are you sure you want to permanently delete these ${selectedPaperIds.size} entries? This action will remove the rows from Google Sheets.`,
      variant: 'danger',
      onConfirm: () => {
        bulkDeleteMutation.mutate(Array.from(selectedPaperIds));
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { }, variant: 'info' });
      },
      onCancel: () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { }, onCancel: () => { }, variant: 'info' })
    });
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
      'summary', 'abstract', 'critical_evaluation', 'remarks', 'useful_snippet'
    ];

    const csvRows = [
      headers.join(','),
      ...papersToExport.map(p => {
        return headers.map(header => {
          const val = (p as any)[header] || '';
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

  const SortIndicator = ({ column }: { column: keyof Paper }) => {
    if (sortConfig?.key !== column) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp size={10} className="ml-1 inline" /> : <ArrowDown size={10} className="ml-1 inline" />;
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

  const handleLogout = () => {
    signOut();
    navigate('/setup');
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
      <p className="text-red-600 mb-8 max-w-md font-bold">Could not reach your Google Sheets database. Make sure your spreadsheet is shared correctly and you are logged in.</p>
      <button onClick={() => navigate('/setup')} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-100">Update Credentials</button>
    </div>
  );

  const totalWidth = Object.values(columnWidths).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <aside className={`bg-white border-r border-slate-200 flex flex-col z-20 shrink-0 transition-all duration-300 ${isSidebarVisible ? 'w-72' : 'w-0 border-r-0 overflow-hidden'}`}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 cursor-pointer group" onClick={() => setActiveFolderId(null)}>
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:scale-105 transition-transform duration-200">
              <LibraryIcon size={18} className="stroke-[2.25]" />
            </div>
            <span className="font-extrabold text-slate-800 tracking-tight text-lg group-hover:text-blue-600 transition-colors">Nexus</span>
          </div>
          <button
            onClick={() => setIsManageFoldersOpen(true)}
            className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-xl transition-all"
            title="Manage Folders"
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
                isActive={activeFolderId === item.id}
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
          <div className="flex items-center">
            <button
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              className="mr-4 p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 hover:text-slate-900"
              title={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
            >
              {isSidebarVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeFolderId ? activeFolderId : "Full Library"}
            </h2>
          </div>
          <div className="flex items-center space-x-6">
            {selectedPaperIds.size > 0 && (
              <div className="flex items-center bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-left-2 space-x-4">
                <span className="text-xs font-black text-blue-600 uppercase tracking-widest border-r border-blue-200 pr-4">{selectedPaperIds.size} Selected</span>

                <div className="flex items-center space-x-4">
                  <button onClick={exportToCSV} className="flex items-center space-x-2 text-blue-700 hover:text-blue-900 text-[10px] font-black uppercase tracking-widest transition-colors">
                    <Download size={14} />
                    <span>Export</span>
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
            
            <div className="relative">
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center space-x-3 p-1.5 px-4 hover:bg-slate-50 rounded-2xl border border-slate-200 transition-all">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-[10px] uppercase">G</div>
                <span className="text-sm font-bold text-slate-700">Google User</span>
                <ChevronDown size={14} className={isProfileOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-[110] p-1">
                  <button onClick={() => { navigate('/setup'); setIsProfileOpen(false); }} className="w-full text-left p-3 hover:bg-blue-50 rounded-lg text-sm font-bold flex items-center space-x-3">
                    <Database size={16} />
                    <span>Settings</span>
                  </button>
                  <button onClick={handleLogout} className="w-full text-left p-3 hover:bg-red-50 rounded-lg text-sm font-bold text-red-600 flex items-center space-x-3">
                    <LogOut size={16} />
                    <span>Disconnect</span>
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
                  className="px-10 py-5 sticky left-0 bg-white z-40 shadow-sm relative group cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ width: columnWidths.identity, left: columnWidths.selection }}
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center">
                    <span>Paper & Identity</span>
                    <SortIndicator column="title" />
                  </div>
                  <div onMouseDown={(e) => startResizing('identity', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" onClick={(e) => e.stopPropagation()} />
                </th>

                <th className="px-6 py-5 relative group cursor-pointer hover:bg-slate-50 transition-colors" style={{ width: columnWidths.abstract }} onClick={() => handleSort('abstract')}>
                  <div className="flex items-center">
                    <span>Abstract</span>
                    <SortIndicator column="abstract" />
                  </div>
                  <div onMouseDown={(e) => startResizing('abstract', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" onClick={(e) => e.stopPropagation()} />
                </th>
                <th className="px-6 py-5 relative group cursor-pointer hover:bg-slate-50 transition-colors" style={{ width: columnWidths.summary }} onClick={() => handleSort('summary')}>
                  <div className="flex items-center">
                    <span>Summary</span>
                    <SortIndicator column="summary" />
                  </div>
                  <div onMouseDown={(e) => startResizing('summary', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" onClick={(e) => e.stopPropagation()} />
                </th>
                <th className="px-6 py-5 relative group cursor-pointer hover:bg-slate-50 transition-colors" style={{ width: columnWidths.evaluation }} onClick={() => handleSort('critical_evaluation')}>
                  <div className="flex items-center">
                    <span>Critical Evaluation</span>
                    <SortIndicator column="critical_evaluation" />
                  </div>
                  <div onMouseDown={(e) => startResizing('evaluation', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" onClick={(e) => e.stopPropagation()} />
                </th>
                <th className="px-6 py-5 relative group cursor-pointer hover:bg-slate-50 transition-colors" style={{ width: columnWidths.remarks }} onClick={() => handleSort('remarks')}>
                  <div className="flex items-center">
                    <span>Remarks</span>
                    <SortIndicator column="remarks" />
                  </div>
                  <div onMouseDown={(e) => startResizing('remarks', e)} className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-400 cursor-col-resize z-50 transition-colors" onClick={(e) => e.stopPropagation()} />
                </th>
                <th
                  className="px-6 py-5 relative group cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ width: `${columnWidths.snippet}px` }}
                  onClick={() => handleSort('useful_snippet')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span>Useful Snippet</span>
                      <SortIndicator column="useful_snippet" />
                    </div>
                    <div onMouseDown={(e) => startResizing('snippet', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}></div>
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
                    className="px-10 py-6 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-20 shadow-sm group/cell relative cursor-help"
                    style={{ left: columnWidths.selection }}
                    onMouseEnter={(e) => handleCellMouseEnter(paper.id, 'title', e)}
                    onMouseLeave={handleCellMouseLeave}
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

                  <td 
                    className="px-6 py-6 group/cell relative cursor-help"
                    onMouseEnter={(e) => handleCellMouseEnter(paper.id, 'abstract', e)}
                    onMouseLeave={handleCellMouseLeave}
                  >
                    <div className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed overflow-hidden">
                      <MarkdownRenderer content={paper.abstract} />
                    </div>
                  </td>
                  <td 
                    className="px-6 py-6 group/cell relative cursor-help"
                    onMouseEnter={(e) => handleCellMouseEnter(paper.id, 'summary', e)}
                    onMouseLeave={handleCellMouseLeave}
                  >
                    <div className="text-[11px] text-slate-700 font-bold line-clamp-3 leading-relaxed overflow-hidden">
                      <MarkdownRenderer content={paper.summary} />
                    </div>
                  </td>
                  <td 
                    className="px-6 py-6 group/cell relative cursor-help"
                    onMouseEnter={(e) => handleCellMouseEnter(paper.id, 'critical_evaluation', e)}
                    onMouseLeave={handleCellMouseLeave}
                  >
                    <div className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed overflow-hidden">
                      <MarkdownRenderer content={paper.critical_evaluation} />
                    </div>
                  </td>
                  <td 
                    className="px-6 py-6 group/cell relative cursor-help"
                    onMouseEnter={(e) => handleCellMouseEnter(paper.id, 'remarks', e)}
                    onMouseLeave={handleCellMouseLeave}
                  >
                    <div className="text-[11px] text-slate-400 italic line-clamp-3 leading-relaxed overflow-hidden">
                      <MarkdownRenderer content={paper.remarks} />
                    </div>
                  </td>
                  <td 
                    className="px-6 py-6 group/cell relative cursor-help"
                    onMouseEnter={(e) => handleCellMouseEnter(paper.id, 'useful_snippet', e)}
                    onMouseLeave={handleCellMouseLeave}
                  >
                    <div className="text-[11px] text-blue-700 font-black line-clamp-3 leading-relaxed overflow-hidden">
                      {paper.useful_snippet ? `"${paper.useful_snippet}"` : "—"}
                    </div>
                  </td>
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
        onAdd={async (newPapers) => {
          for (const paper of newPapers) {
            const targetSheet = paper.folder_id || activeFolderId || libraryData?.folders[0]?.id;
            if (!targetSheet) {
              throw new Error("No folder tab available to add paper to.");
            }
            
            const paperToInsert: Paper = {
              id: '',
              title: paper.title || 'Untitled',
              url: paper.url || '',
              pdf_link: paper.pdf_link,
              doi: paper.doi,
              folder_id: targetSheet,
              type: paper.type || 'web',
              authors: paper.authors,
              published_year: paper.published_year,
              summary: paper.summary,
              abstract: paper.abstract,
              remarks: paper.remarks,
              useful_snippet: paper.useful_snippet,
              bibtex: paper.bibtex || ''
            };
            
            await appendPaper(targetSheet, paperToInsert);
          }
          queryClient.invalidateQueries({ queryKey: ['library'] });
        }}
      />

      <ManageCollectionsModal
        isOpen={isManageFoldersOpen}
        onClose={() => setIsManageFoldersOpen(false)}
        folders={libraryData?.folders || []}
        papers={libraryData?.papers || []}
      />

      {editingPaper && (
        <EditPaperModal
          isOpen={true}
          paper={editingPaper}
          folders={libraryData?.folders || []}
          onClose={() => setEditingPaper(null)}
          onUpdate={(updated) => updatePaperMutation.mutate({ ...updated, id: editingPaper.id })}
        />
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

      {activeTooltip && tooltipPaper && (
        <div 
          ref={tooltipRef}
          className="fixed z-[1000] bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 pointer-events-auto"
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleCellMouseLeave}
          style={{ 
            left: '-9999px', 
            top: '-9999px',
            width: activeTooltip.field === 'title' ? '450px' : '384px',
            maxHeight: '350px',
            overflowY: 'auto'
          }}
        >
          {activeTooltip.field === 'title' && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-50 flex items-center space-x-2">
                <FileText size={12} />
                <span>Full Title</span>
              </div>
              <div className="text-sm font-black text-slate-800 leading-snug">
                {tooltipPaper.title}
              </div>
            </>
          )}

          {activeTooltip.field === 'abstract' && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-50 flex items-center space-x-2">
                <Info size={12} />
                <span>Full Abstract</span>
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                <MarkdownRenderer content={tooltipPaper.abstract} />
              </div>
            </>
          )}

          {activeTooltip.field === 'summary' && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-50 flex items-center space-x-2">
                <BookOpen size={12} />
                <span>Detailed Summary</span>
              </div>
              <div className="text-xs text-slate-700 font-medium leading-relaxed">
                <MarkdownRenderer content={tooltipPaper.summary} />
              </div>
            </>
          )}

          {activeTooltip.field === 'critical_evaluation' && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-50 flex items-center space-x-2">
                <AlertCircle size={12} />
                <span>Critical Evaluation</span>
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                <MarkdownRenderer content={tooltipPaper.critical_evaluation} />
              </div>
            </>
          )}

          {activeTooltip.field === 'remarks' && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-50 flex items-center space-x-2">
                <MessageSquare size={12} />
                <span>Remarks & Notes</span>
              </div>
              <div className="text-xs text-slate-400 italic leading-relaxed">
                <MarkdownRenderer content={tooltipPaper.remarks} />
              </div>
            </>
          )}

          {activeTooltip.field === 'useful_snippet' && (
            <>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-50 flex items-center space-x-2">
                <Quote size={12} />
                <span>Useful Snippet</span>
              </div>
              <div className="text-xs text-blue-800 font-black leading-relaxed">
                "{tooltipPaper.useful_snippet}"
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Library;
