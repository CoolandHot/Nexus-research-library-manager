
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, FileText, Info, Layout, Star, Tag, Quote, MessageCircle, Calendar, User } from 'lucide-react';
// Use the correct library client accessor for paper data
import { getLibraryClient } from '../lib/supabase';
import { Paper } from '../types';

const Reader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: paper, isLoading } = useQuery({
    queryKey: ['paper', id],
    queryFn: async () => {
      // Use getLibraryClient as getSupabaseClient is not defined
      const client = getLibraryClient();
      if (!client || !id) return null;
      const { data, error } = await client.from('papers').select('*').eq('id', id).single();
      if (error) throw error;

      const p = data as any;
      return {
        ...p,
        userLabel: p.user_label,
        critical_evaluation: p.critical_evaluation,
        useful_snippet: p.useful_snippet
      } as Paper;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="flex items-center justify-center h-screen bg-slate-50"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!paper) return <div className="p-8 text-red-500 font-bold bg-white h-screen">Resource not found in database.</div>;

  return (
    <div className="flex h-screen bg-white overflow-hidden flex-col">
      <nav className="h-20 border-b border-slate-100 flex items-center justify-between px-8 z-50 shrink-0">
        <div className="flex items-center space-x-6 overflow-hidden">
          <button 
            onClick={() => navigate('/')}
            className="p-3 hover:bg-slate-50 rounded-2xl text-slate-500 transition-colors border border-slate-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center space-x-3 overflow-hidden">
            {paper.type === 'pdf' ? <FileText size={24} className="text-red-500 shrink-0" /> : <Layout size={24} className="text-emerald-500 shrink-0" />}
            <div>
              <h1 className="text-lg font-black text-slate-900 truncate tracking-tight">{paper.title}</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resource Insights</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <a 
            href={paper.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-200 hover:bg-blue-700"
          >
            <ExternalLink size={16} />
            <span>Open Source</span>
          </a>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10 lg:p-16">
        <div className="max-w-5xl mx-auto space-y-12">
          {/* Header Section */}
          <section className="space-y-6">
            <h2 className="text-5xl font-black text-slate-900 leading-[1.1] tracking-tight">{paper.title}</h2>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2 px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
                <User size={14} />
                <span>{paper.authors || "Unknown Authors"}</span>
              </div>
              <div className="flex items-center space-x-2 px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
                <Calendar size={14} />
                <span>{paper.published_year || "No Date"}</span>
              </div>
              {paper.userLabel && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold">
                  <Tag size={14} />
                  <span>{paper.userLabel}</span>
                </div>
              )}
              <div className="flex items-center space-x-1 px-4 py-2 bg-amber-50 rounded-xl">
                {[1,2,3,4,5].map(star => (
                  <Star key={star} size={14} className={`${star <= (paper.importance || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                ))}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Left Column: Abstract & Summary */}
            <div className="lg:col-span-2 space-y-12">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <Info size={16} />
                  <span>Abstract</span>
                </h3>
                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                  <p className="text-slate-600 leading-relaxed text-lg italic whitespace-pre-wrap">
                    {paper.abstract || "No abstract provided for this entry."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <MessageCircle size={16} />
                  <span>Critical Evaluation</span>
                </h3>
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm">
                  <p className="text-slate-700 leading-relaxed">
                    {paper.critical_evaluation || "Review pending."}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Key Snippets & Remarks */}
            <div className="space-y-12">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <Quote size={16} />
                  <span>Key Snippet</span>
                </h3>
                <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-200">
                  <p className="text-lg font-medium leading-relaxed italic">
                    "{paper.useful_snippet || "No core evidence snippet recorded yet."}"
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                  <Info size={16} />
                  <span>General Remarks</span>
                </h3>
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-slate-300">
                  <p className="text-sm leading-relaxed">
                    {paper.summary || "No general remarks saved."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reader;
