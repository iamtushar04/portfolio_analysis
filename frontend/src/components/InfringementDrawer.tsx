'use client';
import React from 'react';
import {
    X, ShieldAlert, ChevronRight, FileBarChart, Download,
    Check, ArrowLeft, Building2, Loader2,
} from 'lucide-react';
import ProductCard from './ProductCard';
import axios from 'axios';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface InfringementDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    patentNumber: string | null;
    result: any;
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function InfringementDrawer({ isOpen, onClose, patentNumber, result }: InfringementDrawerProps) {
    // ── data extraction ──────────────────────
    const data = result?.results?.[0]?.full_result || result || {};
    const products: any[] = data?.products || [];
    const title: string = data?.title || '';

    // ── state ────────────────────────────────
    const [drawerView, setDrawerView] = React.useState<'products' | 'claim-chart'>('products');
    const [isSelectionMode, setIsSelectionMode] = React.useState(false);
    const [selectedProducts, setSelectedProducts] = React.useState<Set<number>>(new Set());
    
    // Initialize generating state from localStorage to prevent state loss on close
    const [generatingProductIds, setGeneratingProductIds] = React.useState<Set<number>>(() => {
        if (typeof window !== 'undefined' && patentNumber) {
            const saved = localStorage.getItem(`generating_charts_${patentNumber}`);
            if (saved) return new Set(JSON.parse(saved));
        }
        return new Set();
    });
    
    const [cachedClaimCharts, setCachedClaimCharts] = React.useState<Record<number, any>>({});
    const [activeChartIdx, setActiveChartIdx] = React.useState<number | null>(null);

    // Track active background jobs so we can resume polling if drawer is reopened
    interface ClaimChartJob {
        jobId: string;
        indices: number[];
    }
    const [activeJobs, setActiveJobs] = React.useState<ClaimChartJob[]>(() => {
        if (typeof window !== 'undefined' && patentNumber) {
            const saved = localStorage.getItem(`claim_chart_jobs_${patentNumber}`);
            if (saved) return JSON.parse(saved);
        }
        return [];
    });

    // State to track which patent's state is currently loaded into memory.
    // We use useState instead of useRef so it batches with generatingProductIds updates!
    const [activePatentState, setActivePatentState] = React.useState<string | null>(null);

    // Sync generating state to localStorage ONLY if we have actually loaded this patent
    React.useEffect(() => {
        if (patentNumber && activePatentState === patentNumber) {
            localStorage.setItem(`generating_charts_${patentNumber}`, JSON.stringify(Array.from(generatingProductIds)));
            localStorage.setItem(`claim_chart_jobs_${patentNumber}`, JSON.stringify(activeJobs));
        }
    }, [generatingProductIds, activeJobs, patentNumber, activePatentState]);

    // ── reset on close / patent change ───────
    React.useEffect(() => {
        if (!isOpen) {
            setDrawerView('products');
            setIsSelectionMode(false);
            setSelectedProducts(new Set());
            setActiveChartIdx(null);
            // We intentionally DO NOT reset generatingProductIds or cachedClaimCharts here on close, 
            // so they don't flash empty while the drawer slides away.
        } else if (patentNumber) {
            // Only reset generating state if the patent has actually changed
            if (activePatentState !== patentNumber) {
                // VERY IMPORTANT: Clear previous patent's state before loading the new one!
                // Because we use useState for activePatentState, React batches these 3 updates into a single render.
                setActivePatentState(patentNumber);
                setGeneratingProductIds(new Set());
                setActiveJobs([]);
                setCachedClaimCharts({});
                
                // Restore generating state for this new patent
                const savedGenerating = localStorage.getItem(`generating_charts_${patentNumber}`);
                if (savedGenerating) {
                    setGeneratingProductIds(new Set(JSON.parse(savedGenerating)));
                }

                // Restore active background jobs for this new patent
                const savedJobs = localStorage.getItem(`claim_chart_jobs_${patentNumber}`);
                if (savedJobs) {
                    setActiveJobs(JSON.parse(savedJobs));
                }
            }
            
            // ALWAYS fetch cache when opening, even if it's the same patent,
            // to check if background jobs finished while drawer was closed.
            fetchCachedCharts();
        }
    }, [isOpen, patentNumber]);
    
    // ── helpers ──────────────────────────────
    const findProductIndex = (chartData: any) => {
        return products.findIndex((p: any) => {
            const c1 = (p.company || "").toLowerCase().trim();
            const c2 = (chartData.company || "").toLowerCase().trim();
            const m1 = (p.model || "").toLowerCase().trim();
            const m2 = (chartData.model || "").toLowerCase().trim();
            
            if (c1 === c2 && m1 === m2) return true;
            
            if (c1 && c2 && (c1.includes(c2) || c2.includes(c1))) {
                if (m1 && m2 && (m1.includes(m2) || m2.includes(m1))) return true;
                const m1First = m1.split(' ')[0];
                const m2First = m2.split(' ')[0];
                if (m1First && m2First && m1First === m2First) return true;
            }
            return false;
        });
    };

    const fetchCachedCharts = async () => {
        if (!patentNumber) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/claim-chart/cache/${patentNumber}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const cachedResults = res.data || [];
            if (cachedResults.length > 0) {
                const newCharts: Record<number, any> = {};
                const foundIndices: number[] = [];
                cachedResults.forEach((chartData: any) => {
                    const pIdx = findProductIndex(chartData);
                    if (pIdx !== -1) {
                        newCharts[pIdx] = chartData;
                        foundIndices.push(pIdx);
                    }
                });
                setCachedClaimCharts(newCharts);
                
                // Clear them from generating state if they just finished while drawer was closed
                if (foundIndices.length > 0) {
                    setGeneratingProductIds(prev => {
                        const next = new Set(prev);
                        foundIndices.forEach(i => next.delete(i));
                        return next;
                    });
                }
            }
        } catch (error) {
            console.error("Failed to fetch cached claim charts:", error);
        }
    };

    // ── Resume polling for active jobs ──
    React.useEffect(() => {
        if (!isOpen || activeJobs.length === 0) return;
        
        const token = localStorage.getItem('token');
        const intervals = activeJobs.map(job => {
            return setInterval(async () => {
                try {
                    const statusRes = await axios.get(
                        `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/claim-chart/${job.jobId}/status`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const statusData = statusRes.data;

                    if (statusData.status === 'completed') {
                        removeFromGenerating(job.indices);
                        setActiveJobs(prev => prev.filter(j => j.jobId !== job.jobId));

                        const newCharts: Record<number, any> = {};
                        (statusData.result?.products_analysis || []).forEach((prodAnalysis: any) => {
                            const pIdx = findProductIndex(prodAnalysis);
                            if (pIdx !== -1) newCharts[pIdx] = prodAnalysis;
                        });
                        setCachedClaimCharts(prev => ({ ...prev, ...newCharts }));
                        toast.success('Claim chart generated successfully!');
                    } else if (statusData.status === 'error') {
                        removeFromGenerating(job.indices);
                        setActiveJobs(prev => prev.filter(j => j.jobId !== job.jobId));
                        toast.error('Error generating claim chart: ' + statusData.error_message);
                    }
                } catch (err) {
                    console.error('Background polling error', err);
                }
            }, 5000);
        });

        return () => {
            intervals.forEach(interval => clearInterval(interval));
        };
    }, [isOpen, activeJobs, patentNumber]);

    if (!isOpen) return null;

    // ── helpers ──────────────────────────────
    const handleToggleSelect = (idx: number, val: boolean) => {
        setSelectedProducts(prev => {
            const next = new Set(prev);
            val ? next.add(idx) : next.delete(idx);
            return next;
        });
    };

    const removeFromGenerating = (indices: number[]) => {
        setGeneratingProductIds(prev => {
            const next = new Set(prev);
            indices.forEach(i => next.delete(i));
            return next;
        });
    };

    const handleGenerateForProducts = async (indices: number[]) => {
        const selectedList = indices.map(idx => products[idx]);
        if (selectedList.length === 0) return;

        // exit selection mode immediately, mark cards as generating
        setIsSelectionMode(false);
        setSelectedProducts(new Set());
        setGeneratingProductIds(prev => {
            const next = new Set(prev);
            indices.forEach(i => next.add(i));
            return next;
        });

        try {
            const token = localStorage.getItem('token');
            const kypUserId = localStorage.getItem('user_id');

            const startRes = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/claim-chart/start`,
                {
                    patent_number: patentNumber,
                    assignees: ['Unknown'],
                    products: selectedList,
                    custom_instructions: '',
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'x-kyp-user-id': kypUserId || '1',
                    },
                }
            );

            const jobId = startRes.data.job_id;
            
            // Add to active jobs, which will automatically trigger the background polling loop
            setActiveJobs(prev => [...prev, { jobId, indices }]);

        } catch (error) {
            console.error('Failed to start generation', error);
            removeFromGenerating(indices);
            toast.error('Failed to start claim chart generation.');
        }
    };

    const openClaimChart = (idx: number) => {
        setActiveChartIdx(idx);
        setDrawerView('claim-chart');
    };

    // ── PDF export ───────────────────────────
    const exportToPDF = () => {
        const chartsToExport = Object.entries(cachedClaimCharts);
        if (chartsToExport.length === 0) return;

        try {
            const doc = new jsPDF();
            const patentNum = patentNumber || 'Unknown';

            chartsToExport.forEach(([, chartData], exportIdx) => {
                if (exportIdx > 0) doc.addPage();

                let yPos = 20;

                doc.setFontSize(16);
                doc.setTextColor(30, 58, 138);
                doc.text('Claim Chart Report', 14, yPos);
                yPos += 10;

                doc.setFontSize(10);
                doc.setTextColor(71, 85, 105);
                doc.text(`Patent: ${patentNum}`, 14, yPos); yPos += 6;
                doc.text(`Company: ${chartData.company || ''}`, 14, yPos); yPos += 6;
                doc.text(`Model: ${chartData.model || ''}`, 14, yPos); yPos += 6;
                doc.text(`Category: ${chartData.category || 'N/A'}`, 14, yPos); yPos += 6;
                doc.text(`EOU Probability: ${chartData.eou_probability || 'N/A'}`, 14, yPos); yPos += 6;

                if (chartData.disclaimer) {
                    doc.setFontSize(9);
                    doc.setTextColor(220, 38, 38);
                    const lines = doc.splitTextToSize(`Disclaimer: ${chartData.disclaimer}`, 180);
                    doc.text(lines, 14, yPos);
                    yPos += lines.length * 4 + 4;
                } else {
                    yPos += 6;
                }

                const stripHtml = (html: string) => {
                    const tmp = document.createElement('DIV');
                    tmp.innerHTML = html;
                    return tmp.textContent || tmp.innerText || '';
                };

                const tableData = (chartData.claim_chart || []).map((row: any) => [
                    stripHtml(row.claim_element || ''),
                    stripHtml(row.spec_support || ''),
                    row.score || '',
                    stripHtml(row.corresponding_feature || row.source_justification || ''),
                ]);

                if (tableData.length > 0) {
                    autoTable(doc, {
                        startY: yPos,
                        head: [['Claim Element', 'Spec Support', 'Score', 'Analysis']],
                        body: tableData,
                        headStyles: { fillColor: [79, 70, 229] },
                        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
                        columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 40 }, 2: { cellWidth: 18 }, 3: { cellWidth: 77 } },
                    });
                }
            });

            doc.save(`claim-chart-${patentNum}.pdf`);
            toast.success('PDF downloaded!');
        } catch (err) {
            console.error('PDF error', err);
            toast.error('Failed to generate PDF');
        }
    };

    // ── derived ──────────────────────────────
    const completedChartIndices = Object.keys(cachedClaimCharts).map(Number);
    const activeChart = activeChartIdx !== null ? cachedClaimCharts[activeChartIdx] : null;

    // ─────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────
    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose} />

            {/* Drawer Shell */}
            <div className="fixed inset-y-0 right-0 w-[920px] max-w-[100vw] bg-slate-900 border-l border-slate-700/60 shadow-2xl z-[101] flex flex-col overflow-hidden">

                {/* ══════════════════════════════════════════
                    PAGE 1 — Products List
                ══════════════════════════════════════════ */}
                <div
                    className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-in-out ${
                        drawerView === 'products' ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    {/* Header */}
                    <div className="shrink-0 bg-slate-900/95 backdrop-blur border-b border-slate-700/60 px-6 py-5 flex justify-between items-start z-10 shadow-sm">
                        <div>
                            <div className="flex items-center gap-3 text-rose-400 mb-2">
                                <ShieldAlert size={24} />
                                <h2 className="text-2xl font-bold tracking-tight">Infringement Analysis</h2>
                            </div>
                            <div className="text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                                <span className="bg-slate-800 px-2.5 py-1 rounded-md text-sm font-semibold border border-slate-700">
                                    {patentNumber}
                                </span>
                                {title && (
                                    <>
                                        <ChevronRight size={14} className="text-slate-600" />
                                        <span className="text-slate-300 text-sm font-sans truncate max-w-[420px]">{title}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            {/* View All Charts button — visible when at least 1 chart is ready */}
                            {completedChartIndices.length > 0 && (
                                <button
                                    onClick={() => {
                                        setActiveChartIdx(completedChartIndices[0]);
                                        setDrawerView('claim-chart');
                                    }}
                                    className="flex items-center gap-2 bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 border border-emerald-600/40 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                                >
                                    <FileBarChart size={15} />
                                    View Claim Charts ({completedChartIndices.length})
                                </button>
                            )}

                            {/* Select Multiple toggle */}
                            {products.length > 0 && (
                                <button
                                    onClick={() => {
                                        setIsSelectionMode(v => !v);
                                        setSelectedProducts(new Set());
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                                        isSelectionMode
                                            ? 'bg-indigo-600 text-white border-indigo-500'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                    }`}
                                >
                                    <Check size={15} />
                                    {isSelectionMode ? 'Selecting...' : 'Select Multiple'}
                                </button>
                            )}

                            <button
                                onClick={onClose}
                                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8 space-y-8 pb-28">

                        {/* Novelty Summary */}
                        {data?.novelty_summary && (
                            <div className="bg-indigo-900/10 p-5 rounded-xl border border-indigo-500/20 shadow-inner">
                                <h3 className="text-xs font-bold text-indigo-400 mb-3 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                    Novelty Summary
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-300">{data.novelty_summary}</p>
                            </div>
                        )}

                        {/* Products list header */}
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Infringing Products</h3>
                            <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs font-bold border border-slate-700">
                                {products.length}
                            </span>
                        </div>

                        {products.length > 0 ? (
                            <div className="space-y-6">
                                {products.map((p: any, idx: number) => (
                                    <ProductCard
                                        key={idx}
                                        product={p}
                                        isSelectionMode={isSelectionMode}
                                        isSelected={selectedProducts.has(idx)}
                                        onSelect={(val) => handleToggleSelect(idx, val)}
                                        isGenerating={generatingProductIds.has(idx)}
                                        hasClaimChart={!!cachedClaimCharts[idx]}
                                        onGenerateClaimChart={() => handleGenerateForProducts([idx])}
                                        onViewClaimChart={() => openClaimChart(idx)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-slate-500 text-sm italic p-6 bg-slate-800/30 rounded-xl border border-slate-700/30 text-center">
                                No infringing products found in the analysis.
                            </div>
                        )}

                        {/* Raw API data (collapsible debug) */}
                        <div className="mt-6 pt-6 border-t border-slate-800">
                            <details className="group cursor-pointer">
                                <summary className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider focus:outline-none">
                                    Show Raw API Data
                                </summary>
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto max-h-[300px] mt-2">
                                    <pre className="text-[10px] text-slate-500 font-mono">{JSON.stringify(result, null, 2)}</pre>
                                </div>
                            </details>
                        </div>
                    </div>

                    {/* Selection mode bottom bar */}
                    {isSelectionMode && (
                        <div className="shrink-0 bg-slate-900/95 border-t border-slate-700/60 px-8 py-4 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.4)] z-20">
                            <div className="text-slate-300 text-sm">
                                <span className="font-bold text-indigo-400">{selectedProducts.size}</span> product(s) selected
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setIsSelectionMode(false); setSelectedProducts(new Set()); }}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleGenerateForProducts(Array.from(selectedProducts))}
                                    disabled={selectedProducts.size === 0}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/20"
                                >
                                    <FileBarChart size={16} />
                                    Generate Selected ({selectedProducts.size})
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ══════════════════════════════════════════
                    PAGE 2 — Claim Chart Viewer
                ══════════════════════════════════════════ */}
                <div
                    className={`absolute inset-0 flex flex-col bg-slate-900 transition-transform duration-300 ease-in-out ${
                        drawerView === 'claim-chart' ? 'translate-x-0' : 'translate-x-full'
                    }`}
                >
                    {/* Viewer Header */}
                    <div className="shrink-0 bg-slate-900/95 backdrop-blur border-b border-slate-700/60 px-6 py-5 flex justify-between items-center z-10 shadow-sm">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setDrawerView('products')}
                                className="flex items-center gap-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <FileBarChart size={18} className="text-indigo-400" />
                                    Claim Chart Analysis
                                </h2>
                                <p className="text-xs text-slate-400 font-mono">{patentNumber}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={exportToPDF}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/20"
                            >
                                <Download size={16} />
                                Download PDF
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Viewer Body */}
                    <div className="flex flex-1 overflow-hidden">

                        {/* Left Sidebar — product list (only if > 1 chart) */}
                        {completedChartIndices.length > 1 && (
                            <div className="w-64 shrink-0 bg-slate-800/50 border-r border-slate-700/60 overflow-y-auto custom-scrollbar p-4 space-y-2">
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Products</p>
                                {completedChartIndices.map((pidx) => {
                                    const chart = cachedClaimCharts[pidx];
                                    const isActive = pidx === activeChartIdx;
                                    return (
                                        <button
                                            key={pidx}
                                            onClick={() => setActiveChartIdx(pidx)}
                                            className={`w-full text-left px-3 py-3 rounded-lg border transition-all duration-150 ${
                                                isActive
                                                    ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                                                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-800'
                                            }`}
                                        >
                                            <div className="font-semibold text-sm truncate">{chart?.company}</div>
                                            <div className="text-xs text-slate-500 truncate mt-0.5">{chart?.model}</div>
                                            <div className="mt-2 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                                <span className="text-[10px] text-emerald-400 font-bold uppercase">Chart Ready</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Right Content — active chart */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            {activeChart ? (
                                <div className="space-y-6">
                                    {/* Product info bar */}
                                    <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                                        <div className="flex items-center gap-2 text-white font-bold text-lg">
                                            <Building2 size={18} className="text-indigo-400" />
                                            {activeChart.company}
                                        </div>
                                        <span className="text-slate-500">·</span>
                                        <div className="text-slate-300 font-medium">{activeChart.model}</div>
                                        {activeChart.category && (
                                            <span className="px-2.5 py-1 rounded-md bg-slate-700 text-slate-300 text-xs font-medium border border-slate-600">
                                                {activeChart.category}
                                            </span>
                                        )}
                                        {activeChart.eou_probability && (
                                            <span className={`px-2.5 py-1 rounded-md border text-xs font-bold uppercase ${
                                                activeChart.eou_probability?.toLowerCase() === 'high'
                                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                                    : activeChart.eou_probability?.toLowerCase() === 'medium'
                                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                    : 'bg-slate-700 text-slate-400 border-slate-600'
                                            }`}>
                                                {activeChart.eou_probability} Probability
                                            </span>
                                        )}
                                    </div>

                                    {/* Disclaimer */}
                                    {activeChart.disclaimer && (
                                        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                                            <h4 className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <ShieldAlert size={14} />
                                                Analysis Disclaimer
                                            </h4>
                                            <p className="text-slate-300 text-sm leading-relaxed">{activeChart.disclaimer}</p>
                                        </div>
                                    )}

                                    {/* Claim Chart Table */}
                                    {(activeChart.claim_chart || []).length > 0 ? (
                                        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-indigo-900/50 text-indigo-200 text-xs uppercase tracking-wider">
                                                        <th className="p-4 font-semibold border-b border-indigo-500/20 w-[22%]">Claim Element</th>
                                                        <th className="p-4 font-semibold border-b border-indigo-500/20 w-[25%]">Spec Support</th>
                                                        <th className="p-4 font-semibold border-b border-indigo-500/20 w-[8%] text-center">Score</th>
                                                        <th className="p-4 font-semibold border-b border-indigo-500/20">Analysis / Justification</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-sm text-slate-300 divide-y divide-slate-800/60">
                                                    {activeChart.claim_chart.map((row: any, i: number) => {
                                                        const markup = (html: string) => ({
                                                            __html: (html || '').replace(/<mark>/gi, '<mark style="background:rgba(99,102,241,0.25);color:#c7d2fe;padding:0 3px;border-radius:3px">'),
                                                        });
                                                        return (
                                                            <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                                                                <td className="p-4 align-top leading-relaxed text-slate-200" dangerouslySetInnerHTML={markup(row.claim_element)} />
                                                                <td className="p-4 align-top leading-relaxed text-slate-400" dangerouslySetInnerHTML={markup(row.spec_support)} />
                                                                <td className="p-4 align-top text-center">
                                                                    <span className="inline-block px-2 py-1 rounded-md bg-slate-800 border border-slate-700 font-mono text-indigo-400 font-bold text-sm">
                                                                        {row.score || '—'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 align-top leading-relaxed text-slate-300" dangerouslySetInnerHTML={markup(row.corresponding_feature || row.source_justification || '')} />
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-slate-500 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                            No claim chart rows returned for this product.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center space-y-3">
                                        <Loader2 size={36} className="animate-spin text-indigo-500 mx-auto" />
                                        <p className="text-slate-400 text-sm">Loading claim chart...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
}
