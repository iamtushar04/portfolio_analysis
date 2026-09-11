"use client";
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Users, ExternalLink } from 'lucide-react';

function AssigneeList({ assignees, fallback }: { assignees?: string[]; fallback?: string }) {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  let list: string[] = [];
  if (Array.isArray(assignees) && assignees.length > 0) {
    list = assignees.filter(a => a && a !== 'Unknown');
  } else if (fallback && fallback !== 'Unknown') {
    list = [fallback];
  }

  if (list.length === 0) {
    return (
      <div className="text-xs text-slate-500 truncate flex items-center gap-1">
        <Users size={12} /> Unknown Assignee
      </div>
    );
  }

  const visible = list.slice(0, 2);
  const hiddenCount = list.length - 2;
  const allNames = list.join(' | ');

  return (
    <div className="text-xs text-slate-400 flex items-center gap-1 flex-wrap">
      <Users size={12} className="shrink-0 text-slate-400" />
      {visible.map((a, idx) => (
        <span key={idx} className="truncate max-w-[140px]" title={allNames}>
          {a}{idx < visible.length - 1 ? ',' : ''}
        </span>
      ))}
      {hiddenCount > 0 && (
        <div className="relative inline-block">
          <span
            className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold cursor-pointer border border-indigo-500/30 select-none"
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
          >
            +{hiddenCount} more
          </span>
          {tooltipVisible && (
            <div
              style={{ position: 'fixed', zIndex: 9999, transform: 'translateY(-100%) translateY(-6px)' }}
              className="bg-slate-800 text-slate-200 text-xs rounded p-2 shadow-2xl border border-slate-600 min-w-[180px] max-w-xs pointer-events-none"
            >
              <div className="font-bold text-[10px] text-indigo-400 mb-1 border-b border-slate-700 pb-0.5">
                All Assignees ({list.length}):
              </div>
              <ul className="list-disc pl-3.5 space-y-0.5 text-[11px]">
                {list.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResultsTable({ patents }: { patents: any[] }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (!patents || patents.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-300">
        <thead className="text-xs uppercase bg-slate-800/50 text-slate-400 sticky top-0 z-10 backdrop-blur-md">
          <tr>
            <th className="px-4 py-3 rounded-tl-lg">Patent No</th>
            <th className="px-4 py-3">Title & Assignee</th>
            <th className="px-4 py-3">Taxonomy</th>
            <th className="px-4 py-3">Standards</th>
            <th className="px-4 py-3 text-center rounded-tr-lg">Citations</th>
          </tr>
        </thead>
        <tbody>
          {patents.map((p) => {
            const isExpanded = expandedRow === p.patent_number;
            const isPending = p.status === 'pending';
            const isFailed = p.status === 'failed';

            return (
              <React.Fragment key={p.patent_number}>
                <tr
                  className={`border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-800/50' : ''}`}
                  onClick={() => setExpandedRow(isExpanded ? null : p.patent_number)}
                >
                  <td className="px-4 py-4 font-medium text-indigo-300 whitespace-nowrap">
                    {p.patent_number}
                  </td>
                  <td className="px-4 py-4 max-w-xs">
                    {isPending ? (
                      <div className="flex items-center gap-2 text-slate-500">
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-indigo-400"></div>
                        <span>Processing patent...</span>
                      </div>
                    ) : isFailed ? (
                      <div>
                        <div className="text-rose-400 font-semibold flex items-center gap-1.5">
                          <span>Processing Failed</span>
                        </div>
                        {p.error_message && (
                          <div className="text-xs text-rose-300/80 mt-0.5 line-clamp-1" title={p.error_message}>
                            {p.error_message}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-slate-200 line-clamp-2" title={p.title}>
                          {p.title || 'Untitled Patent'}
                        </div>
                        <div className="mt-1">
                          <AssigneeList assignees={p.assignees} fallback={p.assignee} />
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    {isPending || isFailed ? (
                      <span className="text-slate-600">-</span>
                    ) : (() => {
                      // Group taxonomies by Domain -> Topic -> Subtopics
                      const grouped: { [domain: string]: { [topic: string]: string[] } } = {};
                      p.taxonomies?.forEach((t: any) => {
                        const d = t.domain || 'General';
                        const top = t.topic || 'General Topic';
                        const sub = t.subtopic;

                        if (!grouped[d]) grouped[d] = {};
                        if (!grouped[d][top]) grouped[d][top] = [];
                        if (sub && !grouped[d][top].includes(sub)) {
                          grouped[d][top].push(sub);
                        }
                      });

                      return (
                        <div className="flex flex-col gap-1.5 max-w-md max-h-32 overflow-y-auto custom-scrollbar pr-1.5">
                          {Object.entries(grouped).map(([domain, topics], dIdx) => (
                            <div key={dIdx} className="bg-slate-800/40 rounded p-1.5 border border-slate-700/60 shadow-sm">
                              {/* Domain Header */}
                              <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1 border-b border-slate-700/50 pb-0.5">
                                <span className="w-1 h-1 rounded-full bg-indigo-400"></span>
                                {domain}
                              </div>

                              {/* Topics & Subtopics Vertical Tree */}
                              <div className="pl-1.5 space-y-1">
                                {Object.entries(topics).map(([topic, subtopics], tIdx) => (
                                  <div key={tIdx} className="border-l border-slate-700 pl-1.5 py-0.5">
                                    <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1 leading-tight">
                                      <span className="text-slate-500 text-[10px]">└</span> {topic}
                                    </div>
                                    {subtopics.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-0.5 pl-2">
                                        {subtopics.map((sub, sIdx) => (
                                          <span key={sIdx} className="px-1.5 py-[1px] rounded text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 leading-none">
                                            {sub}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </td>

                  <td className="px-4 py-4">
                    {isPending || isFailed ? (
                      <span className="text-slate-600">-</span>
                    ) : (
                      <div>
                        {p.standard ? (
                          p.standard_links ? (
                            <a href={p.standard_links} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-medium hover:bg-indigo-500/20 hover:underline transition-colors flex items-center justify-center gap-1.5 w-fit">
                              {p.standard}
                              <ExternalLink size={10} className="shrink-0" />
                            </a>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium flex items-center justify-center w-fit">
                              {p.standard}
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-500">No Standard</span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4 text-center">
                    {isPending || isFailed ? (
                      <span className="text-slate-600">-</span>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-semibold text-emerald-400">{p.forward_citations?.length || 0}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Fwd</span>
                        </div>
                        <div className="h-6 w-px bg-slate-700"></div>
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-semibold text-rose-400">{p.backward_citations?.length || 0}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Bwd</span>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-slate-500 ml-2" /> : <ChevronDown size={16} className="text-slate-500 ml-2" />}
                      </div>
                    )}
                  </td>
                </tr>

                {/* Expanded Details Row */}
                {isExpanded && !isPending && !isFailed && (
                  <tr>
                    <td colSpan={5} className="p-0 border-b border-slate-700/50">
                      <div className="bg-slate-900/50 p-6 shadow-inner flex flex-col md:flex-row gap-6">
                        <div className="flex-1 space-y-4">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Abstract</h4>
                            <p className="text-sm text-slate-300 leading-relaxed max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                              {p.abstract || 'No abstract available.'}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Competitors</h4>
                            <div className="space-y-3">
                              <div>
                                <span className="text-[11px] font-semibold text-emerald-400 block mb-1">Forward Citation Competitors</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {p.forward_competitors?.map((c: string, i: number) => (
                                    <span key={i} className="px-2 py-0.5 rounded bg-emerald-500/10 text-xs text-emerald-300 border border-emerald-500/20">
                                      {c}
                                    </span>
                                  ))}
                                  {(!p.forward_competitors || p.forward_competitors.length === 0) && <span className="text-xs text-slate-500">No forward competitors found.</span>}
                                </div>
                              </div>
                              <div>
                                <span className="text-[11px] font-semibold text-rose-400 block mb-1">Backward Citation Competitors</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {p.backward_competitors?.map((c: string, i: number) => (
                                    <span key={i} className="px-2 py-0.5 rounded bg-rose-500/10 text-xs text-rose-300 border border-rose-500/20">
                                      {c}
                                    </span>
                                  ))}
                                  {(!p.backward_competitors || p.backward_competitors.length === 0) && <span className="text-xs text-slate-500">No backward competitors found.</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 flex gap-4 min-h-0">
                          <div className="flex-1 bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 flex flex-col min-h-0 max-h-96">
                              <h4 className="text-xs font-bold text-emerald-400 mb-3 flex justify-between shrink-0">
                                Forward Citations <span className="bg-emerald-500/20 px-1.5 rounded">{p.forward_citations?.length || 0}</span>
                              </h4>
                              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-2">
                                {p.forward_citations?.map((c: any, i: number) => (
                                  <div key={i} className="text-xs text-slate-300 py-1.5 border-b border-slate-700/50 last:border-0 flex flex-col">
                                    <span className="font-medium">{typeof c === 'string' ? c : c.patent_number}</span>
                                    {typeof c === 'object' && (
                                      <div className="mt-0.5">
                                        <AssigneeList assignees={c.assignees} fallback={c.assignee} />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          <div className="flex-1 bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 flex flex-col min-h-0 max-h-96">
                              <h4 className="text-xs font-bold text-rose-400 mb-3 flex justify-between shrink-0">
                                Backward Citations <span className="bg-rose-500/20 px-1.5 rounded">{p.backward_citations?.length || 0}</span>
                              </h4>
                              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-2">
                                {p.backward_citations?.map((c: any, i: number) => (
                                  <div key={i} className="text-xs text-slate-300 py-1.5 border-b border-slate-700/50 last:border-0 flex flex-col">
                                    <span className="font-medium">{typeof c === 'string' ? c : c.patent_number}</span>
                                    {typeof c === 'object' && (
                                      <div className="mt-0.5">
                                        <AssigneeList assignees={c.assignees} fallback={c.assignee} />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
