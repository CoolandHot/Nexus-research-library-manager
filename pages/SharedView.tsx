
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { authSupabase } from '../lib/supabase';
import { Paper, ShareLink } from '../types';
import { BookOpen, Calendar, Hash, FileText, AlertTriangle, Eye, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SharedView: React.FC = () => {
    const { shareId } = useParams<{ shareId: string }>();
    const [shareLink, setShareLink] = useState<ShareLink | null>(null);
    const [papers, setPapers] = useState<Paper[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedPapers, setExpandedPapers] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!shareId) return;

        const fetchSharedData = async () => {
            try {
                if (!authSupabase) throw new Error('Unable to connect to database');

                // Fetch share link with embedded paper data from global database
                const { data: linkData, error: linkError } = await authSupabase
                    .from('share_links')
                    .select('*')
                    .eq('share_id', shareId)
                    .single();

                if (linkError) throw new Error('Share link not found');

                const link = linkData as ShareLink;
                setShareLink(link);

                // Papers are already embedded in the share link
                setPapers(link.papers || []);

                // Increment access count
                await authSupabase
                    .from('share_links')
                    .update({ access_count: link.access_count + 1 })
                    .eq('id', link.id);

                setLoading(false);
            } catch (err: any) {
                setError(err.message || 'Failed to load shared content');
                setLoading(false);
            }
        };

        fetchSharedData();
    }, [shareId]);

    const toggleExpanded = (paperId: string) => {
        setExpandedPapers(prev => {
            const next = new Set(prev);
            if (next.has(paperId)) {
                next.delete(paperId);
            } else {
                next.add(paperId);
            }
            return next;
        });
    };

    const MarkdownRenderer: React.FC<{ content: string | undefined }> = ({ content }) => {
        if (!content) return <span className="text-slate-400 italic">Not available</span>;
        return (
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
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
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !shareLink) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-red-50 p-10 text-center">
                <AlertTriangle size={48} className="text-red-600 mb-4" />
                <h2 className="text-2xl font-black text-red-900 mb-2">Share Link Not Found</h2>
                <p className="text-red-600 mb-8 max-w-md font-bold">{error || 'This share link may have been deleted or does not exist.'}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 px-8 py-6 sticky top-0 z-50 shadow-sm">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold italic shadow-lg shadow-blue-200">N</div>
                        <span className="font-extrabold text-slate-800 tracking-tight text-lg">Nexus Research</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2">{shareLink.title}</h1>
                    {shareLink.description && (
                        <p className="text-slate-600 mb-3">{shareLink.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-slate-500">
                        <span className="flex items-center space-x-1">
                            <BookOpen size={14} />
                            <span>{papers.length} papers</span>
                        </span>
                        <span className="flex items-center space-x-1">
                            <Eye size={14} />
                            <span>{shareLink.access_count} views</span>
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-8 py-10">
                <div className="space-y-6">
                    {papers.map((paper) => {
                        const isExpanded = expandedPapers.has(paper.id);
                        return (
                            <div key={paper.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="text-xl font-black text-slate-900 mb-2">
                                                {paper.title}
                                            </h3>
                                            {paper.authors && (
                                                <p className="text-sm text-slate-600 italic mb-2">{paper.authors}</p>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                {paper.published_year && (
                                                    <span className="flex items-center space-x-1 px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">
                                                        <Calendar size={10} />
                                                        <span>{paper.published_year}</span>
                                                    </span>
                                                )}
                                                {paper.doi && (
                                                    <span className="flex items-center space-x-1 px-2 py-1 bg-blue-50 rounded text-xs font-bold text-blue-600">
                                                        <Hash size={10} />
                                                        <span>{paper.doi}</span>
                                                    </span>
                                                )}
                                                {paper.pdf_link && (
                                                    <span className="flex items-center space-x-1 px-2 py-1 bg-red-50 rounded text-xs font-bold text-red-600">
                                                        <FileText size={10} />
                                                        <span>PDF</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleExpanded(paper.id)}
                                            className="ml-4 p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            <ChevronDown
                                                size={20}
                                                className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                            />
                                        </button>
                                    </div>

                                    {paper.url && (
                                        <a
                                            href={paper.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:underline mb-4 inline-block"
                                        >
                                            View Source →
                                        </a>
                                    )}

                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                                            {paper.abstract && (
                                                <div>
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Abstract</h4>
                                                    <div className="text-sm text-slate-600 leading-relaxed">
                                                        <MarkdownRenderer content={paper.abstract} />
                                                    </div>
                                                </div>
                                            )}
                                            {paper.summary && (
                                                <div>
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Summary</h4>
                                                    <div className="text-sm text-slate-700 leading-relaxed">
                                                        <MarkdownRenderer content={paper.summary} />
                                                    </div>
                                                </div>
                                            )}
                                            {paper.critical_evaluation && (
                                                <div>
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Critical Evaluation</h4>
                                                    <div className="text-sm text-slate-600 leading-relaxed">
                                                        <MarkdownRenderer content={paper.critical_evaluation} />
                                                    </div>
                                                </div>
                                            )}
                                            {paper.remarks && (
                                                <div>
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Remarks</h4>
                                                    <div className="text-sm text-slate-500 italic leading-relaxed">
                                                        <MarkdownRenderer content={paper.remarks} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
};

export default SharedView;
