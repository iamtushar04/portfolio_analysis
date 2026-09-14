"use client";
import React, { useState, useEffect } from 'react';
import { Users, ExternalLink } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import PatentDetailDrawer from './PatentDetailDrawer';

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

function PatentRow({ p, isSelected, onSelect }: { p: any; isSelected: boolean; onSelect: () => void }) {
  const isPending = p.status === 'pending';
  const isFailed = p.status === 'failed';

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

  const canSelect = !isPending && !isFailed;

  return (
    <div className={`flex flex-col border-b border-slate-700/50 ${isSelected ? 'bg-slate-800/50' : ''}`}>
      {/* Main Row */}
      <div
        className={`grid grid-cols-[160px_minmax(200px,2fr)_minmax(180px,1.5fr)_minmax(120px,1fr)_120px] items-center transition-colors text-sm text-slate-300 ${canSelect ? 'cursor-pointer hover:bg-slate-800/30' : 'cursor-default'} ${isSelected ? 'border-l-2 border-indigo-500' : ''}`}
        onClick={() => canSelect && onSelect()}
      >
        {/* Patent Number */}
        <div className="px-4 py-4 font-medium text-indigo-300 truncate">
          {p.patent_number}
        </div>

        {/* Title & Assignee */}
        <div className="px-4 py-4">
          {isPending ? (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-indigo-400"></div>
              <span>Processing patent...</span>
            </div>
          ) : isFailed ? (
            <div>
              <div className="text-rose-400 font-semibold">Processing Failed</div>
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
        </div>

        {/* Taxonomy */}
        <div className="px-4 py-4">
          {isPending || isFailed ? (
            <span className="text-slate-600">-</span>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1.5">
              {Object.entries(grouped).map(([domain, topics], dIdx) => (
                <div key={dIdx} className="bg-slate-800/40 rounded p-1.5 border border-slate-700/60 shadow-sm">
                  <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1 border-b border-slate-700/50 pb-0.5">
                    <span className="w-1 h-1 rounded-full bg-indigo-400 inline-block"></span>
                    {domain}
                  </div>
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
              {Object.keys(grouped).length === 0 && (
                <span className="text-slate-600 text-xs italic">-</span>
              )}
            </div>
          )}
        </div>

        {/* Standards */}
        <div className="px-4 py-4">
          {isPending || isFailed ? (
            <span className="text-slate-600">-</span>
          ) : (
            <div>
              {p.standard ? (
                p.standard_links ? (
                  <a
                    href={p.standard_links}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-medium hover:bg-indigo-500/20 hover:underline transition-colors flex items-center gap-1.5 w-fit"
                    onClick={e => e.stopPropagation()}
                  >
                    {p.standard}
                    <ExternalLink size={10} className="shrink-0" />
                  </a>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium flex items-center w-fit">
                    {p.standard}
                  </span>
                )
              ) : (
                <span className="text-xs text-slate-500">No Standard</span>
              )}
            </div>
          )}
        </div>

        {/* Citations */}
        <div className="px-4 py-4 text-center">
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
            </div>
          )}
        </div>
      </div>

    </div>
  );
}


export default function ResultsTable({ patents }: { patents: any[] }) {
  const [selectedPatent, setSelectedPatent] = useState<any | null>(null);

  useEffect(() => {
    if (!selectedPatent) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); // Prevent page scrolling

        const currentIndex = patents.findIndex(p => p.patent_number === selectedPatent.patent_number);
        if (currentIndex === -1) return;

        if (e.key === 'ArrowDown' && currentIndex < patents.length - 1) {
          setSelectedPatent(patents[currentIndex + 1]);
        } else if (e.key === 'ArrowUp' && currentIndex > 0) {
          setSelectedPatent(patents[currentIndex - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPatent, patents]);

  if (!patents || patents.length === 0) return null;

  return (
    <>
      <div className="w-full bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        {/* Sticky Header */}
        <div className="grid grid-cols-[160px_minmax(200px,2fr)_minmax(180px,1.5fr)_minmax(120px,1fr)_120px] text-xs uppercase bg-slate-800 text-slate-400 shrink-0 border-b border-slate-700">
          <div className="px-4 py-3 font-semibold">Patent No</div>
          <div className="px-4 py-3 font-semibold">Title & Assignee</div>
          <div className="px-4 py-3 font-semibold">Taxonomy</div>
          <div className="px-4 py-3 font-semibold">Standards</div>
          <div className="px-4 py-3 font-semibold text-center">Citations</div>
        </div>

        {/* Virtualized Body */}
        <div className="flex-1 min-h-0">
          <Virtuoso
            className="h-full w-full custom-scrollbar"
            data={patents}
            itemContent={(_index, p) => (
              <PatentRow
                p={p}
                isSelected={selectedPatent?.patent_number === p.patent_number}
                onSelect={() => setSelectedPatent(p)}
              />
            )}
          />
        </div>
      </div>

      {/* Slide-Out Drawer */}
      <PatentDetailDrawer
        patent={selectedPatent}
        onClose={() => setSelectedPatent(null)}
      />
    </>
  );
}
