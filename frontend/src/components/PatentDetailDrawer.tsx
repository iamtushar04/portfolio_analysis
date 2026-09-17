"use client";
import React, { useEffect, useRef, useState } from 'react';
import { X, Users, ExternalLink, Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Network, Ghost, Search } from 'lucide-react';

function EmptyState({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 opacity-50">
      <Ghost size={28} className="mb-2 text-slate-500" />
      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">{title}</span>
    </div>
  );
}

function AssigneeChip({ assignees, fallback }: { assignees?: string[]; fallback?: string }) {
  let list: string[] = [];
  if (Array.isArray(assignees) && assignees.length > 0) {
    list = assignees.filter(a => a && a !== 'Unknown');
  } else if (fallback && fallback !== 'Unknown') {
    list = [fallback];
  }
  if (list.length === 0) return <span className="text-xs text-slate-500 italic">Unknown Assignee</span>;

  const displayList = list.slice(0, 3).join(', ');
  const hiddenCount = list.length - 3;

  return (
    <div className="relative group flex items-center">
      <span className="text-xs text-slate-400 flex items-center gap-1 cursor-help hover:text-slate-300 transition-colors">
        <Users size={11} className="shrink-0" />
        <span className="truncate max-w-[200px] sm:max-w-[300px]">{displayList}</span>
        {hiddenCount > 0 && <span className="text-indigo-400 font-medium">+{hiddenCount} more</span>}
      </span>

      {/* Tooltip Overlay */}
      <div className="absolute top-full left-0 mt-2 hidden group-hover:flex flex-col bg-slate-800 border border-slate-700/80 p-3 rounded-lg shadow-2xl z-[100] min-w-[220px] max-w-[350px] backdrop-blur-xl">
        <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 border-b border-slate-700/50 pb-1.5">All Assignees</div>
        <div className="text-xs text-slate-300 max-h-[200px] overflow-y-auto custom-scrollbar flex flex-col gap-1.5">
          {list.map((a, i) => (
            <span key={i} className="whitespace-normal leading-snug">{a}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaxonomyNode({ name, childrenObj, level = 0 }: { name: string, childrenObj: any, level?: number }) {
  const [isOpen, setIsOpen] = useState(level < 1); // Auto-open first level
  const hasChildren = childrenObj && Object.keys(childrenObj).length > 0;

  return (
    <div className="flex flex-col">
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-white/5 transition-colors ${hasChildren ? 'cursor-pointer' : ''}`}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren ? (
          isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
        ) : (
          <div className="w-3.5" />
        )}

        {hasChildren ? (
          isOpen ? <FolderOpen size={14} className="text-amber-400" /> : <Folder size={14} className="text-amber-400" />
        ) : (
          <FileText size={14} className="text-blue-400" />
        )}

        <span className={`text-sm ${level === 0 ? 'text-slate-200 font-semibold' : 'text-slate-300'}`}>
          {name}
        </span>
      </div>

      {hasChildren && isOpen && (
        <div className="flex flex-col border-l border-slate-700/50 ml-[22px] mt-1 mb-1">
          {Object.entries(childrenObj).map(([childName, grandChildren]) => (
            <TaxonomyNode key={childName} name={childName} childrenObj={grandChildren} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaxonomyTree({ taxonomies }: { taxonomies: any[] }) {
  if (!taxonomies || taxonomies.length === 0) {
    return <p className="text-sm text-slate-500 italic px-2">No taxonomy data available.</p>;
  }

  // Build tree from flat array
  const tree: any = {};
  taxonomies.forEach(tax => {
    const domain = tax.domain || 'Unknown Domain';
    const topic = tax.topic || 'Unknown Topic';
    const subtopic = tax.subtopic || 'Unknown Subtopic';

    if (!tree[domain]) tree[domain] = {};
    if (!tree[domain][topic]) tree[domain][topic] = {};
    if (!tree[domain][topic][subtopic]) tree[domain][topic][subtopic] = {};
  });

  return (
    <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
      {Object.entries(tree).map(([domainName, topics]) => (
        <TaxonomyNode key={domainName} name={domainName} childrenObj={topics} level={0} />
      ))}
    </div>
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

  const [compSearch, setCompSearch] = useState("");
  const [citSearch, setCitSearch] = useState("");
  const [rankBy, setRankBy] = useState<'topic' | 'subtopic'>('topic');

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

  const isProcessing = patent && (patent.status === 'processing' || patent.status === 'pending');

  // Filtering logic
  const filteredFwdComp = (patent?.forward_competitors || []).filter((c: string) => c.toLowerCase().includes(compSearch.toLowerCase()));
  const filteredBwdComp = (patent?.backward_competitors || []).filter((c: string) => c.toLowerCase().includes(compSearch.toLowerCase()));

  const filteredFwdCit = (patent?.forward_citations || []).filter((c: any) =>
    c.publication_number?.toLowerCase().includes(citSearch.toLowerCase()) ||
    c.assignee?.toLowerCase().includes(citSearch.toLowerCase())
  );

  const filteredBwdCit = (patent?.backward_citations || []).filter((c: any) =>
    c.publication_number?.toLowerCase().includes(citSearch.toLowerCase()) ||
    c.assignee?.toLowerCase().includes(citSearch.toLowerCase())
  );

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
                    {isProcessing ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-3 bg-slate-700/50 rounded w-full"></div>
                        <div className="h-3 bg-slate-700/50 rounded w-5/6"></div>
                        <div className="h-3 bg-slate-700/50 rounded w-4/6"></div>
                      </div>
                    ) : patent.abstract ? (
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {patent.abstract}
                      </p>
                    ) : (
                      <EmptyState title="No Abstract Available" />
                    )}
                  </div>
                </div>
              </div>

              {/* Taxonomy Card */}
              <div className="relative rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-cyan-600" />
                <div className="pl-5 pr-4 pt-4 pb-4">
                  <h3 className="text-[11px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-blue-500/60 inline-block" />
                    Technology Classification
                  </h3>
                  {isProcessing ? (
                    <div className="space-y-3 animate-pulse pt-2 px-2">
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-slate-700/50"></div><div className="h-3 bg-slate-700/50 rounded w-1/3"></div></div>
                      <div className="flex items-center gap-2 pl-4"><div className="w-4 h-4 rounded bg-slate-700/50"></div><div className="h-3 bg-slate-700/50 rounded w-1/4"></div></div>
                    </div>
                  ) : patent.taxonomies && patent.taxonomies.length > 0 ? (
                    <TaxonomyTree taxonomies={patent.taxonomies} />
                  ) : (
                    <EmptyState title="No Taxonomy Data" />
                  )}
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

                  {isProcessing ? (
                    <div className="space-y-4 animate-pulse pt-2 px-2">
                      <div className="flex gap-2 flex-wrap"><div className="w-16 h-6 rounded-full bg-slate-700/50"></div><div className="w-20 h-6 rounded-full bg-slate-700/50"></div><div className="w-14 h-6 rounded-full bg-slate-700/50"></div></div>
                      <div className="flex gap-2 flex-wrap"><div className="w-24 h-6 rounded-full bg-slate-700/50"></div><div className="w-16 h-6 rounded-full bg-slate-700/50"></div></div>
                    </div>
                  ) : (!patent.forward_competitors?.length && !patent.backward_competitors?.length) ? (
                    <EmptyState title="No Competitors Found" />
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-4 bg-slate-800/50 border border-slate-700/50 rounded-lg px-2.5 py-1.5 focus-within:border-emerald-500/50 transition-colors">
                        <Search size={12} className="text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search competitors..."
                          className="bg-transparent border-none outline-none text-xs text-slate-300 w-full placeholder:text-slate-600"
                          value={compSearch}
                          onChange={e => setCompSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-[250px] overflow-y-auto custom-scrollbar pr-1 space-y-4">
                        <div ref={fwdCompRef} />
                        {/* Forward */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.6)]" />
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Forward Citation Competitors</span>
                          </div>
                          {filteredFwdComp.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {filteredFwdComp.map((c: string, i: number) => (
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
                          {filteredBwdComp.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {filteredBwdComp.map((c: string, i: number) => (
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
                    </>
                  )}
                </div>
              </div>

              {/* Relevance-Ranked Assignees Card */}
              <div className="relative rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 to-orange-600" />
                <div className="pl-5 pr-4 pt-4 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-4 h-px bg-amber-500/60 inline-block" />
                      Relevance-Ranked Assignees
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded px-2 py-1">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Rank By:</span>
                        <select
                          className="bg-transparent text-xs text-amber-300 font-medium outline-none border-none cursor-pointer"
                          value={rankBy}
                          onChange={(e) => setRankBy(e.target.value as 'topic' | 'subtopic')}
                        >
                          <option className="bg-slate-800 text-amber-300" value="topic">Topic</option>
                          <option className="bg-slate-800 text-amber-300" value="subtopic">Subtopic</option>
                        </select>
                      </div>
                      <span className="text-[10px] font-semibold text-amber-500/70">
                        Top {patent.ranked_forward_assignees?.length || 0}
                      </span>
                    </div>
                  </div>
                  
                  {isProcessing ? (
                     <div className="space-y-4 animate-pulse pt-2 px-2">
                        <div className="h-12 bg-slate-700/50 rounded-lg w-full"></div>
                        <div className="h-12 bg-slate-700/50 rounded-lg w-full"></div>
                     </div>
                  ) : (!patent.ranked_forward_assignees || patent.ranked_forward_assignees.length === 0) ? (
                    <EmptyState title="No Ranked Assignees" />
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1 space-y-3">
                      {(() => {
                         const sortedList = [...patent.ranked_forward_assignees].sort((a: any, b: any) => {
                           const scoreA = rankBy === 'topic' ? (a.topic_avg || 0) : (a.subtopic_avg || 0);
                           const scoreB = rankBy === 'topic' ? (b.topic_avg || 0) : (b.subtopic_avg || 0);
                           return scoreB - scoreA;
                         });
                         return sortedList.map((assignee: any, i: number) => {
                           const topicEvals = assignee.topic_evals || (assignee.topic_eval ? [assignee.topic_eval] : []);
                         const subtopicEvals = assignee.subtopic_evals || (assignee.subtopic_eval ? [assignee.subtopic_eval] : []);
                         
                         const maxTopicScore = topicEvals.length > 0 ? Math.max(...topicEvals.map((e:any) => e.score || 0)) : 0;
                         const maxSubtopicScore = subtopicEvals.length > 0 ? Math.max(...subtopicEvals.map((e:any) => e.score || 0)) : 0;
                         const activeScore = rankBy === 'topic' ? (assignee.topic_avg || 0) : (assignee.subtopic_avg || 0);
                         
                         return (
                          <div key={`ranked-${i}`} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/30">
                              <span className="text-sm font-bold text-slate-200">{assignee.name}</span>
                              <div className="flex gap-2 items-center">
                                <span className={`text-sm font-bold px-2 py-0.5 rounded ${activeScore >= 5 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-700/50 text-slate-400'}`} title="Score">
                                  {activeScore.toFixed(1)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              {topicEvals.map((evalObj: any, idx: number) => evalObj.reason ? (
                                <div key={`teval-${idx}`}>
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center flex-wrap gap-x-1">
                                    Topic Evidence {evalObj.term && <span className="text-indigo-400 normal-case">- {evalObj.term}</span>}
                                    <span className="font-bold text-amber-500/80 normal-case">({evalObj.score}/10)</span>
                                  </div>
                                  <p className="text-xs text-slate-300 italic mt-0.5">{evalObj.reason}</p>
                                  {evalObj.source && (
                                    <a href={evalObj.source} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1">
                                      <ExternalLink size={10} /> Source
                                    </a>
                                  )}
                                </div>
                              ) : null)}
                              
                              {subtopicEvals.map((evalObj: any, idx: number) => evalObj.reason ? (
                                <div key={`seval-${idx}`}>
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center flex-wrap gap-x-1">
                                    Subtopic Evidence {evalObj.term && <span className="text-indigo-400 normal-case">- {evalObj.term}</span>}
                                    <span className="font-bold text-amber-500/80 normal-case">({evalObj.score}/10)</span>
                                  </div>
                                  <p className="text-xs text-slate-300 italic mt-0.5">{evalObj.reason}</p>
                                  {evalObj.source && (
                                    <a href={evalObj.source} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1">
                                      <ExternalLink size={10} /> Source
                                    </a>
                                  )}
                                </div>
                              ) : null)}
                            </div>
                          </div>
                         );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* KYP Card */}
              <div className="relative rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-pink-600" />
                <div className="pl-5 pr-4 pt-4 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-4 h-px bg-purple-500/60 inline-block" />
                      KYP Rank & Classifications
                    </h3>
                    {patent.kyp_score != null && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                        Score: {patent.kyp_score}/100
                      </span>
                    )}
                  </div>
                  
                  {isProcessing ? (
                     <div className="space-y-4 animate-pulse pt-2 px-2">
                        <div className="h-8 bg-slate-700/50 rounded-lg w-full"></div>
                        <div className="h-16 bg-slate-700/50 rounded-lg w-full"></div>
                     </div>
                  ) : (!patent.kyp_score_data && (!patent.kyp_classifications || patent.kyp_classifications.length === 0)) ? (
                    <EmptyState title="No KYP Data Available" />
                  ) : (
                    <div className="space-y-4">
                      {patent.kyp_score_data && (
                        <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-3">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Scoring Parameters</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(patent.kyp_score_data).map(([key, value]) => {
                              if (typeof value === 'object' || key === 'classifications' || key === 'rank' || key === 'title') return null;
                              return (
                                <div key={key} className="bg-slate-900/50 rounded p-2 flex flex-col justify-center">
                                  <div className="text-[9px] text-slate-500 font-bold uppercase truncate" title={key.replace(/_/g, ' ')}>{key.replace(/_/g, ' ')}</div>
                                  <div className="text-xs font-semibold text-slate-300 mt-0.5 truncate" title={String(value)}>{String(value)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {patent.kyp_classifications && patent.kyp_classifications.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Matched Classifications</div>
                          <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                            {patent.kyp_classifications.map((c: any, idx: number) => (
                              <div key={idx} className="bg-slate-800/30 border border-slate-700/30 rounded p-2 flex gap-2 items-start">
                                <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                  {c.code}
                                </span>
                                <span className="text-xs text-slate-400 leading-tight">
                                  {c.description}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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


                  {isProcessing ? (
                    <div className="space-y-4 animate-pulse pt-2 px-2">
                      <div className="flex gap-3 items-center"><div className="w-2 h-2 rounded-full bg-slate-700/50"></div><div className="h-4 bg-slate-700/50 rounded w-1/3"></div></div>
                      <div className="flex gap-3 items-center"><div className="w-2 h-2 rounded-full bg-slate-700/50"></div><div className="h-4 bg-slate-700/50 rounded w-1/4"></div></div>
                      <div className="flex gap-3 items-center"><div className="w-2 h-2 rounded-full bg-slate-700/50"></div><div className="h-4 bg-slate-700/50 rounded w-1/2"></div></div>
                    </div>
                  ) : (!patent.forward_citations?.length && !patent.backward_citations?.length) ? (
                    <EmptyState title="No Citations Found" />
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-4 bg-slate-800/50 border border-slate-700/50 rounded-lg px-2.5 py-1.5 focus-within:border-sky-500/50 transition-colors">
                        <Search size={12} className="text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search citations..."
                          className="bg-transparent border-none outline-none text-xs text-slate-300 w-full placeholder:text-slate-600"
                          value={citSearch}
                          onChange={e => setCitSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-1 space-y-1">
                        <div ref={fwdCitRef} />
                        {/* Forward Citations */}
                        {filteredFwdCit.length > 0 ? (
                          <>
                            <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider py-1.5 sticky top-0 bg-slate-900/90 backdrop-blur-sm z-10">
                              Forward Citations
                            </div>
                            {filteredFwdCit.map((c: any, i: number) => (
                              <div key={`fwd-${i}`} className="flex items-start gap-2.5 py-2 border-b border-slate-700/30 last:border-0 group">
                                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                                    {typeof c === 'string' ? c : c.patent_number || c.publication_number}
                                  </span>
                                  {typeof c === 'object' && (
                                    <AssigneeChip assignees={c.assignees} fallback={c.assignee} />
                                  )}
                                </div>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 px-4 border border-dashed border-emerald-500/20 rounded-lg bg-emerald-500/5 mb-4">
                            <span className="text-xs font-medium text-emerald-400/60 uppercase tracking-wider mb-1">Forward Citations</span>
                            <span className="text-[10px] text-slate-500">None found</span>
                          </div>
                        )}
                        {/* Backward Citations */}
                        {filteredBwdCit.length > 0 ? (
                          <>
                            <div ref={bwdCitRef} className="text-[10px] font-bold text-rose-500 uppercase tracking-wider py-1.5 sticky top-0 bg-slate-900/90 backdrop-blur-sm mt-2 z-10">
                              Backward Citations
                            </div>
                            {filteredBwdCit.map((c: any, i: number) => (
                              <div key={`bwd-${i}`} className="flex items-start gap-2.5 py-2 border-b border-slate-700/30 last:border-0 group">
                                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shadow-[0_0_4px_rgba(251,113,133,0.5)]" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold text-slate-200 group-hover:text-rose-300 transition-colors">
                                    {typeof c === 'string' ? c : c.patent_number || c.publication_number}
                                  </span>
                                  {typeof c === 'object' && (
                                    <AssigneeChip assignees={c.assignees} fallback={c.assignee} />
                                  )}
                                </div>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 px-4 border border-dashed border-rose-500/20 rounded-lg bg-rose-500/5 mb-4">
                            <span className="text-xs font-medium text-rose-400/60 uppercase tracking-wider mb-1">Backward Citations</span>
                            <span className="text-[10px] text-slate-500">None found</span>
                          </div>
                        )}
                        {(filteredFwdCit.length === 0 && filteredBwdCit.length === 0) && (
                          <div className="py-4 text-center">
                            <span className="text-xs text-slate-500 italic">No citations match your search</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </>
  );
}
