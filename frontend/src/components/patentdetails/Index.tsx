"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Users, ExternalLink, Ghost, ArrowDownWideNarrow } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import PatentDetailDrawer from "../PatentDrawer/Index";

function AssigneeList({
  assignees,
  fallback,
}: {
  assignees?: string[];
  fallback?: string;
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  let list: string[] = [];
  if (Array.isArray(assignees) && assignees.length > 0) {
    list = assignees.filter((a) => a && a !== "Unknown");
  } else if (fallback && fallback !== "Unknown") {
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
  const allNames = list.join(" | ");

  return (
    <div className="text-xs text-slate-400 flex items-center gap-1 flex-wrap">
      <Users size={12} className="shrink-0 text-slate-700" />
      {visible.map((a, idx) => (
        <span key={idx} className="truncate max-w-[140px]" title={allNames}>
          {a}
          {idx < visible.length - 1 ? "," : ""}
        </span>
      ))}
      {hiddenCount > 0 && (
        <div className="relative inline-block">
          <span
            className="px-1.5 py-0.5 rounded bg-slate-200 text-indigo-300 text-[10px] font-semibold cursor-pointer select-none"
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
          >
            +{hiddenCount} more
          </span>
          {tooltipVisible && (
            <div
              style={{
                position: "fixed",
                zIndex: 9999,
                transform: "translateY(-100%) translateY(-6px)",
              }}
              className="bg-slate-800 text-slate-600 text-xs rounded p-2 shadow-2xl border border-slate-100 min-w-[180px] max-w-xs pointer-events-none"
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

function PatentRow({
  p,
  isSelected,
  onSelect,
  sortBy,
  isChecked,
  onToggleCheck,
}: {
  p: any;
  isSelected: boolean;
  onSelect: () => void;
  sortBy: "topic" | "subtopic";
  isChecked: boolean;
  onToggleCheck: (id: string) => void;
}) {
  const isPending = p.status === "pending";
  const isFailed = p.status === "failed";

  // Group taxonomies by Domain -> Topic -> Subtopics
  const grouped: { [domain: string]: { [topic: string]: string[] } } = {};
  p.taxonomies?.forEach((t: any) => {
    const d = t.domain || "General";
    const top = t.topic || "General Topic";
    const sub = t.subtopic;
    if (!grouped[d]) grouped[d] = {};
    if (!grouped[d][top]) grouped[d][top] = [];
    if (sub && !grouped[d][top].includes(sub)) {
      grouped[d][top].push(sub);
    }
  });

  const canSelect = !isPending && !isFailed;

  let mergedScore = 0;
  if (p.ranked_forward_assignees && p.ranked_forward_assignees.length > 0) {
    const sumAvg = p.ranked_forward_assignees.reduce((acc: number, ra: any) => {
      return (
        acc + (sortBy === "topic" ? ra.topic_avg || 0 : ra.subtopic_avg || 0)
      );
    }, 0);
    const avgScore = sumAvg / p.ranked_forward_assignees.length;
    const kyp = p.kyp_score != null ? p.kyp_score : 0;
    mergedScore = kyp * 0.5 + avgScore * 10 * 0.5;
  }

  return (
    <div
      className={`flex flex-col border-b border-slate-100 ${isSelected ? "bg-slate-100" : ""}`}
    >
      {/* Main Row */}
      <div
        className={`grid grid-cols-[40px_160px_minmax(200px,2fr)_minmax(180px,1.5fr)_minmax(120px,1fr)_120px_140px] items-center transition-colors text-sm text-slate-300 ${canSelect ? "cursor-pointer hover:bg-slate-100" : "cursor-default"} ${isSelected ? "border-l-2 border-indigo-500" : ""}`}
        onClick={() => canSelect && onSelect()}
      >
        {/* Checkbox Column */}
        <div
          className="px-3 py-4 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggleCheck(p.patent_number)}
            disabled={!canSelect}
            className="cursor-pointer w-4 h-4 rounded border-slate-600 bg-slate-800 accent-indigo-500"
          />
        </div>
        {/* Patent Number */}
        <div className="px-4 py-4 font-medium text-slate-500">
          {p.patent_number}
        </div>

        {/* Title & Assignee */}
        <div className="px-4 py-4">
          {isPending ? (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-slate-400"></div>
              <span>Processing patent...</span>
            </div>
          ) : isFailed ? (
            <div>
              <div className="text-rose-400 font-semibold">
                Processing Failed
              </div>
              {p.error_message && (
                <div
                  className="text-xs text-rose-300/80 mt-0.5 line-clamp-1"
                  title={p.error_message}
                >
                  {p.error_message}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div
                className="font-semibold text-slate-600 line-clamp-2"
                title={p.title}
              >
                {p.title || "Untitled Patent"}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <AssigneeList assignees={p.assignees} fallback={p.assignee} />
              </div>
            </div>
          )}
        </div>

        {/* Taxonomy */}
        <div className="px-4 py-4">
          {isPending || isFailed ? (
            <span className="text-slate-800">-</span>
          ) : (
            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-1.5">
              {Object.entries(grouped).map(([domain, topics], dIdx) => (
                <div
                  key={dIdx}
                  className="
        relative
        pl-3
      "
                >
                  {/* Domain */}
                  <div
                    className="
          flex
          items-center
          justify-between

          text-indigo-700
          font-bold
          text-[11px]
          uppercase
          tracking-wide

          mb-1
        "
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="
              w-2
              h-2
              rounded-full
              bg-indigo-500
            "
                      />

                      {domain}
                    </div>

                    <span
                      className="
            text-[9px]
            text-slate-500
          "
                    >
                      {Object.keys(topics).length} topics
                    </span>
                  </div>

                  {/* Topics */}
                  <div
                    className="
          ml-1
          border-l
          border-slate-300
          pl-3
          flex
          flex-col
          gap-1.5
        "
                  >
                    {Object.entries(topics).map(([topic, subtopics], tIdx) => (
                      <div
                        key={tIdx}
                        className="
              relative
            "
                      >
                        {/* Topic */}

                        <div
                          className="
                flex
                items-center
                gap-2
                text-[10px]
                font-semibold
                text-slate-700
              "
                        >
                          <span
                            className="
                  absolute
                  -left-[17px]
                  w-2
                  h-2
                  rounded-full
                  bg-slate-400
                "
                          />

                          {topic}
                        </div>

                        {/* Subtopics */}

                        {subtopics.length > 0 && (
                          <div
                            className="
                  ml-3
                  mt-1
                  border-l
                  border-slate-200
                  pl-3

                  flex
                  flex-col
                  gap-1
                "
                          >
                            {subtopics.map((sub, sIdx) => (
                              <div
                                key={sIdx}
                                className="
                      relative
                      text-[9px]
                      text-emerald-700
                    "
                              >
                                <span
                                  className="
                        absolute
                        -left-[17px]
                        top-1
                        w-1.5
                        h-1.5
                        rounded-full
                        bg-emerald-500
                      "
                                />

                                {sub}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {Object.keys(grouped).length === 0 && (
                <span className="text-slate-800 text-xs italic">No data</span>
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
                    onClick={(e) => e.stopPropagation()}
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
                <span className="text-lg font-semibold text-emerald-600">
                  {p.forward_citations?.length || 0}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Fwd
                </span>
              </div>
              <div className="h-6 w-px bg-slate-700"></div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-semibold text-rose-600">
                  {p.backward_citations?.length || 0}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Bwd
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Ranked Score */}
        <div className="px-4 py-4 flex justify-center">
          {isPending || isFailed ? (
            <span className="text-slate-600">-</span>
          ) : (
            <div className="flex flex-col items-center justify-center bg-slate-200 rounded-lg px-4 py-1.5 shadow-inner w-full max-w-[90px]">
              <span
                className={`text-xl font-bold leading-none ${mergedScore >= 50 ? "text-amber-700" : "text-slate-500"}`}
              >
                {mergedScore.toFixed(1)}
              </span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                Score
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ResultsTable = ({
  patents,
  selectedForExport,
  onToggleExport,
  onSelectAll,
  sortBy,
  onSortByChange,
}: {
  patents: any[];
  selectedForExport: Set<string>;
  onToggleExport: (id: string) => void;
  onSelectAll: () => void;
  sortBy: "topic" | "subtopic";
  onSortByChange: (val: "topic" | "subtopic") => void;
}) => {
  const [selectedPatent, setSelectedPatent] = useState<any | null>(null);

  const sortedPatents = useMemo(() => {
    return [...patents].sort((a, b) => {
      const getMergedScore = (p: any) => {
        if (
          !p.ranked_forward_assignees ||
          p.ranked_forward_assignees.length === 0
        )
          return 0;
        const sumAvg = p.ranked_forward_assignees.reduce(
          (acc: number, ra: any) => {
            return (
              acc +
              (sortBy === "topic" ? ra.topic_avg || 0 : ra.subtopic_avg || 0)
            );
          },
          0,
        );
        const avgScore = sumAvg / p.ranked_forward_assignees.length;
        const kyp = p.kyp_score != null ? p.kyp_score : 0;
        return kyp * 0.5 + avgScore * 10 * 0.5;
      };

      return getMergedScore(b) - getMergedScore(a);
    });
  }, [patents, sortBy]);

  useEffect(() => {
    if (!selectedPatent) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); // Prevent page scrolling

        const currentIndex = patents.findIndex(
          (p) => p.patent_number === selectedPatent.patent_number,
        );
        if (currentIndex === -1) return;

        if (e.key === "ArrowDown" && currentIndex < patents.length - 1) {
          setSelectedPatent(patents[currentIndex + 1]);
        } else if (e.key === "ArrowUp" && currentIndex > 0) {
          setSelectedPatent(patents[currentIndex - 1]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPatent, patents]);

  if (!patents || patents.length === 0) {
    return (
      <div className="w-full bg-slate-100 rounded-lg overflow-hidden flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <Ghost size={48} className="text-slate-700 mb-4 opacity-50" />
        <h3 className="text-lg font-bold text-slate-500">
          No patents match your search
        </h3>
        <p className="text-sm text-slate-500 mt-2">
          Try adjusting your search terms.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full bg-white rounded-lg overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        {/* Sticky Header */}
        <div className="grid grid-cols-[40px_160px_minmax(200px,2fr)_minmax(180px,1.5fr)_minmax(120px,1fr)_120px_140px] text-xs uppercase bg-slate-100 text-slate-700 shrink-0 items-center">
          <div className="px-3 py-3 flex items-center justify-center">
            <input
              type="checkbox"
              checked={
                patents.length > 0 &&
                selectedForExport.size ===
                  patents.filter(
                    (p: any) => p.status !== "pending" && p.status !== "failed",
                  ).length
              }
              onChange={onSelectAll}
              className="cursor-pointer w-4 h-4 rounded bg-slate-800 accent-indigo-500"
            />
          </div>
          <div className="px-4 py-3 font-semibold">Patent No</div>
          <div className="px-4 py-3 font-semibold">Title & Assignee</div>
          <div className="px-4 py-3 font-semibold">Technology</div>
          <div className="px-4 py-3 font-semibold">Standards</div>
          <div className="px-4 py-3 font-semibold text-center">Citations</div>
          <div className="px-4 py-3 font-semibold text-center flex flex-col items-center justify-center border-l border-slate-700/50">
            <span className="text-slate-500 mb-1">Ranked Score</span>
            <div className="flex items-center gap-1 bg-slate-900/50 rounded px-1.5 py-0.5 w-fit">
              <span className="text-[9px] uppercase tracking-wider text-slate-100 font-bold">
                By:
              </span>
              <select
                className="bg-transparent text-[10px] text-slate-100 font-bold outline-none border-none cursor-pointer text-center"
                value={sortBy}
                onChange={(e) =>
                  onSortByChange(e.target.value as "topic" | "subtopic")
                }
              >
                <option className="bg-slate-200 text-slate-700" value="topic">
                  Topic
                </option>
                <option
                  className="bg-slate-200 text-slate-700"
                  value="subtopic"
                >
                  Subtopic
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Virtualized Body */}
        <div className="flex-1 min-h-0">
          <Virtuoso
            className="h-full w-full custom-scrollbar"
            data={sortedPatents}
            itemContent={(_index, p) => (
              <PatentRow
                p={p}
                isSelected={selectedPatent?.patent_number === p.patent_number}
                onSelect={() => setSelectedPatent(p)}
                sortBy={sortBy}
                isChecked={selectedForExport.has(p.patent_number)}
                onToggleCheck={onToggleExport}
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
export default ResultsTable;
