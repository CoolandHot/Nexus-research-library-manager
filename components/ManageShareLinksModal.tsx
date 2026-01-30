
import React, { useState } from 'react';
import { X, Link as LinkIcon, Copy, Trash2, Calendar, Eye, ExternalLink, CheckCircle } from 'lucide-react';
import { ShareLink, Profile } from '../types';
import { authSupabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ManageShareLinksModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: Profile;
}

const ManageShareLinksModal: React.FC<ManageShareLinksModalProps> = ({ isOpen, onClose, profile }) => {
    const queryClient = useQueryClient();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const { data: shareLinks, isLoading } = useQuery({
        queryKey: ['share_links', profile.id],
        queryFn: async () => {
            if (!authSupabase) throw new Error('Database not initialized');

            const { data, error } = await authSupabase
                .from('share_links')
                .select('*')
                .eq('created_by', profile.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []) as ShareLink[];
        },
        enabled: isOpen && !!authSupabase
    });

    const deleteLinkMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!authSupabase) throw new Error('Database not initialized');

            const { error } = await authSupabase.from('share_links').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['share_links', profile.id] });
        },
        onError: (err: any) => {
            alert('Failed to delete share link: ' + err.message);
        }
    });

    const handleCopyLink = (shareId: string) => {
        const shareUrl = `${window.location.origin}/#/share/${shareId}`;
        navigator.clipboard.writeText(shareUrl);
        setCopiedId(shareId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDelete = (id: string, title: string) => {
        const confirmed = window.confirm(`Are you sure you want to delete the share link "${title}"?`);
        if (confirmed) {
            deleteLinkMutation.mutate(id);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                            <LinkIcon size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Manage Share Links</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">View and manage all shared collections</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-xl">
                        <X size={28} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : shareLinks && shareLinks.length > 0 ? (
                        <div className="space-y-4">
                            {shareLinks.map(link => (
                                <div key={link.id} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-blue-200 transition-all group">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-black text-slate-800 mb-1">{link.title}</h3>
                                            {link.description && (
                                                <p className="text-sm text-slate-500 mb-3">{link.description}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                                <span className="flex items-center space-x-1">
                                                    <Calendar size={12} />
                                                    <span>{new Date(link.created_at).toLocaleDateString()}</span>
                                                </span>
                                                <span className="flex items-center space-x-1">
                                                    <Eye size={12} />
                                                    <span>{link.access_count} views</span>
                                                </span>
                                                <span className="flex items-center space-x-1">
                                                    <LinkIcon size={12} />
                                                    <span>{link.papers?.length || 0} papers</span>
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => handleCopyLink(link.share_id)}
                                                className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                                                title="Copy share link"
                                            >
                                                {copiedId === link.share_id ? <CheckCircle size={18} /> : <Copy size={18} />}
                                            </button>
                                            <a
                                                href={`/#/share/${link.share_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                                title="Open in new tab"
                                            >
                                                <ExternalLink size={18} />
                                            </a>
                                            <button
                                                onClick={() => handleDelete(link.id, link.title)}
                                                className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                                                title="Delete share link"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                        <code className="text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-mono">
                                            {window.location.origin}/#/share/{link.share_id}
                                        </code>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center">
                            <LinkIcon size={48} className="text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold">No share links created yet</p>
                            <p className="text-sm text-slate-400 mt-2">Select papers and create a share link to get started</p>
                        </div>
                    )}
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0 flex items-start space-x-3">
                    <LinkIcon size={18} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                        Share links allow others to view selected papers without requiring login. Links can be deleted at any time to revoke access.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ManageShareLinksModal;
