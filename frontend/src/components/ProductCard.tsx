import React from 'react';
import { ExternalLink, Calendar, Building2, Loader2, FileBarChart, Play } from 'lucide-react';

interface ProductCardProps {
    product: any;
    // Selection mode
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onSelect?: (selected: boolean) => void;
    // Claim chart states
    isGenerating?: boolean;
    hasClaimChart?: boolean;
    onGenerateClaimChart?: () => void;
    onViewClaimChart?: () => void;
}

export default function ProductCard({
    product: p,
    isSelectionMode = false,
    isSelected = false,
    onSelect,
    isGenerating = false,
    hasClaimChart = false,
    onGenerateClaimChart,
    onViewClaimChart,
}: ProductCardProps) {
    const probability = p.eou_probability?.toLowerCase() || '';
    const probColor =
        probability === 'high'
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            : probability === 'medium'
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            : 'bg-slate-500/10 text-slate-400 border-slate-500/20';

    const launchDateDisplay = p.launch_date ? p.launch_date.split(' (')[0] : '';

    const handleCardClick = () => {
        if (isSelectionMode && onSelect) {
            onSelect(!isSelected);
        }
    };

    return (
        <div
            className={`
                bg-slate-800/80 rounded-xl border overflow-hidden shadow-lg transition-all duration-200
                ${isSelectionMode ? 'cursor-pointer' : ''}
                ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-slate-800' : 'border-slate-700 hover:border-slate-600'}
            `}
            onClick={handleCardClick}
        >
            {/* Product Header */}
            <div className="bg-slate-800 p-5 border-b border-slate-700/50 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div className="flex gap-4">
                    {/* Checkbox in selection mode */}
                    {isSelectionMode && (
                        <div className="pt-1 shrink-0">
                            <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                    isSelected
                                        ? 'bg-indigo-600 border-indigo-500'
                                        : 'bg-slate-900 border-slate-600'
                                }`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect && onSelect(!isSelected);
                                }}
                            >
                                {isSelected && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center gap-2 text-indigo-300 font-bold text-lg mb-1">
                            <Building2 size={18} />
                            {p.company}
                        </div>
                        <div className="text-slate-100 text-lg font-medium">{p.model}</div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2 mt-4">
                            {p.eou_probability && (
                                <span className={`px-2.5 py-1 rounded-md border text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 shadow-sm ${probColor}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${probability === 'high' ? 'bg-rose-400 animate-pulse' : probability === 'medium' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                                    {p.eou_probability} Prob
                                </span>
                            )}
                            {p.competitor_type && (
                                <span className="px-2.5 py-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 text-indigo-300 text-[10px] font-bold tracking-wider uppercase shadow-sm">
                                    {p.competitor_type}
                                </span>
                            )}
                            {/* Generating badge */}
                            {isGenerating && (
                                <span className="px-2.5 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 shadow-sm animate-pulse">
                                    <Loader2 size={10} className="animate-spin" />
                                    Generating Chart...
                                </span>
                            )}
                            {/* Chart ready badge */}
                            {hasClaimChart && !isGenerating && (
                                <span className="px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 shadow-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    Chart Ready
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {launchDateDisplay && launchDateDisplay !== 'NA' && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-md border border-slate-700/50 shadow-inner shrink-0">
                        <Calendar size={13} />
                        {launchDateDisplay}
                    </div>
                )}
            </div>

            {/* Excerpt Section */}
            {p.relevant_excerpt && (
                <div className="p-5 bg-slate-800/40 border-b border-slate-700/50">
                    <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-widest font-bold">Relevant Excerpt</div>
                    <blockquote className="border-l-2 border-indigo-500/50 pl-4 py-1 text-sm text-slate-300 italic leading-relaxed">
                        "{p.relevant_excerpt}"
                    </blockquote>
                </div>
            )}

            {/* Evidence Links */}
            {p.infringement_evidence_links && p.infringement_evidence_links.length > 0 && (
                <div className="p-5 bg-slate-900/30">
                    <div className="text-[10px] text-slate-500 mb-3 uppercase tracking-widest font-bold">Evidence Links</div>
                    <ul className="space-y-2.5">
                        {p.infringement_evidence_links.map((rawLink: string, i: number) => {
                            const [url, verification] = rawLink.split(' | ');
                            return (
                                <li key={i} className="flex items-start gap-2">
                                    <ExternalLink size={14} className="shrink-0 text-indigo-500 mt-0.5" />
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <a
                                            href={url?.trim()}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-indigo-400 hover:text-indigo-300 hover:underline break-all"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {url?.trim()}
                                        </a>
                                        {verification && (
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${verification.trim() === 'VERIFIED' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                {verification.trim()}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Action Button — hidden in selection mode */}
            {!isSelectionMode && (hasClaimChart || isGenerating) && (
                <div className="p-4 bg-slate-900/50 border-t border-slate-700/50 flex justify-end">
                    {hasClaimChart ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewClaimChart && onViewClaimChart();
                            }}
                            className="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/40 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                        >
                            <FileBarChart size={15} />
                            View Claim Chart
                        </button>
                    ) : isGenerating ? (
                        <button
                            disabled
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed"
                        >
                            <Loader2 size={15} className="animate-spin" />
                            Generating...
                        </button>
                    ) : null}
                </div>
            )}
        </div>
    );
}
