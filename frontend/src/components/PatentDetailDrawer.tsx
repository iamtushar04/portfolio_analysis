"use client";
import React, { useEffect, useRef } from 'react';
import { X, Users, ExternalLink } from 'lucide-react';

function AssigneeChip({ assignees, fallback }: { assignees?: string[]; fallback?: string }) {
  let list: string[] = [];
  if (Array.isArray(assignees) && assignees.length > 0) {
    list = assignees.filter(a => a && a !== 'Unknown');
  } else if (fallback && fallback !== 'Unknown') {
    list = [fallback];
  }
  if (list.length === 0) return <span className="text-xs text-slate-500 italic">Unknown Assignee</span>;
  return (
    <span className="text-xs text-slate-400 flex items-center gap-1">
      <Users size={11} className="shrink-0" />
      {list.slice(0, 3).join(', ')}
      {list.length > 3 && <span className="text-indigo-400">+{list.length - 3} more</span>}
    </span>
  );
}

interface PatentDetailDrawerProps {
  patent: any | null;
  onClose: () => void;
}

export default function PatentDetailDrawer({ patent, onClose }: PatentDetailDrawerProps) {
  const fwdCompRef = useRef<HTMLDivElement>(null);
  const bwdCompRef = useRef<HTMLDivElement>(null);
  const fwdCitRef = useRef<HTMLDivElement>(null);
  const bwdCitRef = useRef<HTMLDivElement>(null);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isOpen = !!patent;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 w-[600px] max-w-[95vw] flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'linear-gradient(160deg, rgba(15,23,42,0.98) 0%, rgba(23,30,50,0.99) 100%)', borderLeft: '1px solid rgba(99,102,241,0.15)', backdropFilter: 'blur(24px)' }}
      >
        {patent && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-700/60 shrink-0">
              <div className="flex flex-col gap-1 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {patent.patent_number}
                  </span>
                  {patent.standard && (
                    patent.standard_links ? (
                      <a
                        href={patent.standard_links}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1 hover:bg-amber-500/20 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        {patent.standard} <ExternalLink size={9} />
                      </a>
                    ) : (
                      <span className="text-xs text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {patent.standard}
                      </span>
                    )
                  )}
                </div>
                <h2 className="text-base font-bold text-white leading-snug mt-1">
                  {patent.title || 'Untitled Patent'}
                </h2>
                <AssigneeChip assignees={patent.assignees} fallback={patent.assignee} />
              </div>
              <button
                onClick={onClose}
                className="shrink-0 text-slate-500 hover:text-white hover:bg-slate-700/50 p-1.5 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-6 px-6 py-3 bg-slate-800/30 border-b border-slate-700/40 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.6)]" />
                <span className="text-xs text-slate-400">Forward Citations:</span>
                <span className="text-sm font-bold text-emerald-400">{patent.forward_citations?.length || 0}</span>
              </div>
              <div className="w-px h-4 bg-slate-700" />
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_5px_rgba(251,113,133,0.6)]" />
                <span className="text-xs text-slate-400">Backward Citations:</span>
                <span className="text-sm font-bold text-rose-400">{patent.backward_citations?.length || 0}</span>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5 min-h-0">

              {/* Abstract Card */}
              <div className="relative rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-600" />
                <div className="pl-5 pr-4 pt-4 pb-4">
                  <h3 className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-indigo-500/60 inline-block" />
                    Abstract
                  </h3>
                  <div className="max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {patent.abstract || <span className="italic text-slate-500">No abstract available</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Competitors Card */}
              <div className="relative rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-600" />
                <div className="pl-5 pr-4 pt-4 pb-4">
                  <h3 className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-px bg-emerald-500/60 inline-block" />
                      Competitors
                    </span>
                    <span className="flex gap-2">
                      <button onClick={() => scrollToRef(fwdCompRef)} className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors cursor-pointer">
                        ↑ {patent.forward_competitors?.length || 0} Fwd
                      </button>
                      <button onClick={() => scrollToRef(bwdCompRef)} className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 text-[10px] font-bold border border-rose-500/20 hover:bg-rose-500/25 transition-colors cursor-pointer">
                        ↓ {patent.backward_competitors?.length || 0} Bwd
                      </button>
                    </span>
                  </h3>
                  <div className="max-h-[250px] overflow-y-auto custom-scrollbar pr-1 space-y-4">
                    <div ref={fwdCompRef} />
                    {/* Forward */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.6)]" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Forward Citation Competitors</span>
                      </div>
                      {patent.forward_competitors && patent.forward_competitors.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {patent.forward_competitors.map((c: string, i: number) => (
                            <span key={i} className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-xs text-emerald-300 border border-emerald-500/25 font-medium hover:bg-emerald-500/20 transition-colors">
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 italic">None found</span>
                      )}
                    </div>
                    {/* Backward */}
                    <div ref={bwdCompRef} className="border-t border-slate-700/40 pt-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_5px_rgba(251,113,133,0.6)]" />
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wide">Backward Citation Competitors</span>
                      </div>
                      {patent.backward_competitors && patent.backward_competitors.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {patent.backward_competitors.map((c: string, i: number) => (
                            <span key={i} className="px-2.5 py-1 rounded-full bg-rose-500/10 text-xs text-rose-300 border border-rose-500/25 font-medium hover:bg-rose-500/20 transition-colors">
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 italic">None found</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Citations Card */}
              <div className="relative rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-sky-500 to-indigo-600" />
                <div className="pl-5 pr-4 pt-4 pb-4">
                  <h3 className="text-[11px] font-bold text-sky-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-px bg-sky-500/60 inline-block" />
                      Citations
                    </span>
                    <span className="flex gap-2">
                      <button onClick={() => scrollToRef(fwdCitRef)} className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors cursor-pointer">
                        ↑ {patent.forward_citations?.length || 0} Fwd
                      </button>
                      <button onClick={() => scrollToRef(bwdCitRef)} className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 text-[10px] font-bold border border-rose-500/20 hover:bg-rose-500/25 transition-colors cursor-pointer">
                        ↓ {patent.backward_citations?.length || 0} Bwd
                      </button>
                    </span>
                  </h3>
                  <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-1 space-y-1">
                    <div ref={fwdCitRef} />
                    {/* Forward Citations */}
                    {patent.forward_citations && patent.forward_citations.length > 0 && (
                      <>
                        <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider py-1.5 sticky top-0 bg-slate-900/90 backdrop-blur-sm">
                          Forward Citations
                        </div>
                        {patent.forward_citations.map((c: any, i: number) => (
                          <div key={`fwd-${i}`} className="flex items-start gap-2.5 py-2 border-b border-slate-700/30 last:border-0 group">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                                {typeof c === 'string' ? c : c.patent_number}
                              </span>
                              {typeof c === 'object' && (
                                <AssigneeChip assignees={c.assignees} fallback={c.assignee} />
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {/* Backward Citations */}
                    {patent.backward_citations && patent.backward_citations.length > 0 && (
                      <>
                        <div ref={bwdCitRef} className="text-[10px] font-bold text-rose-500 uppercase tracking-wider py-1.5 sticky top-0 bg-slate-900/90 backdrop-blur-sm mt-2">
                          Backward Citations
                        </div>
                        {patent.backward_citations.map((c: any, i: number) => (
                          <div key={`bwd-${i}`} className="flex items-start gap-2.5 py-2 border-b border-slate-700/30 last:border-0 group">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shadow-[0_0_4px_rgba(251,113,133,0.5)]" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-slate-200 group-hover:text-rose-300 transition-colors">
                                {typeof c === 'string' ? c : c.patent_number}
                              </span>
                              {typeof c === 'object' && (
                                <AssigneeChip assignees={c.assignees} fallback={c.assignee} />
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {(!patent.forward_citations || patent.forward_citations.length === 0) &&
                     (!patent.backward_citations || patent.backward_citations.length === 0) && (
                      <span className="text-xs text-slate-600 italic">No citations available</span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </>
  );
}
