import React from 'react';
import { X, ShieldAlert, ExternalLink, Calendar, Building2, ChevronRight } from 'lucide-react';

export default function InfringementDrawer({ 
    isOpen, 
    onClose, 
    patentNumber, 
    result 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    patentNumber: string | null; 
    result: any 
}) {
    if (!isOpen) return null;

    // Safely extract from the nested API response
    // Format is { results: [ { full_result: { products: [...], novelty_summary: "..." } } ] }
    const data = result?.results?.[0]?.full_result || result || {};
    const products = data?.products || [];
    const title = data?.title || '';

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300" 
                onClick={onClose}
            />
            
            {/* Drawer Panel */}
            <div className="fixed inset-y-0 right-0 w-[900px] max-w-[100vw] bg-slate-900 border-l border-slate-700/60 shadow-2xl z-[101] overflow-y-auto transform transition-transform duration-300 ease-in-out flex flex-col custom-scrollbar">
                
                {/* Header */}
                <div className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-slate-700/60 p-6 flex justify-between items-start z-10 shadow-sm">
                    <div>
                        <div className="flex items-center gap-3 text-rose-400 mb-2">
                            <ShieldAlert size={26} />
                            <h2 className="text-2xl font-bold tracking-tight">Infringement Analysis</h2>
                        </div>
                        <div className="text-slate-400 font-mono flex items-center gap-2">
                            <span className="bg-slate-800 px-2.5 py-1 rounded-md text-sm font-semibold border border-slate-700">
                                {patentNumber}
                            </span>
                            {title && (
                                <>
                                    <ChevronRight size={14} className="text-slate-600" />
                                    <span className="text-slate-300 text-sm font-sans tracking-wide truncate max-w-[400px]">
                                        {title}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 flex-1 text-slate-300 space-y-8">
                    
                    {/* Novelty Summary */}
                    {data?.novelty_summary && (
                        <div className="bg-indigo-900/10 p-5 rounded-xl border border-indigo-500/20 shadow-inner">
                            <h3 className="text-xs font-bold text-indigo-400 mb-3 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                Novelty Summary
                            </h3>
                            <p className="text-sm leading-relaxed text-slate-300">{data.novelty_summary}</p>
                        </div>
                    )}
                    
                    {/* Products List */}
                    <div>
                        <div className="flex items-center gap-3 mb-5">
                            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">
                                Infringing Products
                            </h3>
                            <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs font-bold border border-slate-700">
                                {products.length}
                            </span>
                        </div>

                        {products.length > 0 ? (
                            <div className="space-y-6">
                                {products.map((p: any, idx: number) => {
                                    const probability = p.eou_probability?.toLowerCase() || '';
                                    const probColor = probability === 'high' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                                                    : probability === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20';

                                    // Clean up launch date if it has parenthesis like " (verified launch date)"
                                    const launchDateDisplay = p.launch_date ? p.launch_date.split(' (')[0] : '';

                                    return (
                                        <div key={idx} className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-lg transition-colors hover:border-slate-600">
                                            {/* Product Header */}
                                            <div className="bg-slate-800 p-5 border-b border-slate-700/50 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
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
                                                            // Split standard response format like "https://... | VERIFIED"
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
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-slate-500 text-sm italic p-6 bg-slate-800/30 rounded-xl border border-slate-700/30 text-center">
                                No infringing products found in the analysis.
                            </div>
                        )}
                    </div>

                    {/* Raw Dump Fallback for debugging/inspection */}
                    <div className="mt-12 pt-6 border-t border-slate-800">
                        <details className="group cursor-pointer">
                            <summary className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider focus:outline-none">
                                Show Raw API Data
                            </summary>
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto max-h-[300px] mt-2">
                                <pre className="text-[10px] text-slate-500 font-mono">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </>
    );
}
