"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { UploadCloud, ArrowLeft, RefreshCw, Download, Search } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import ResultsTable from '../../../components/ResultsTable';
import { config } from '../../../config';

const API_BASE = config.API_URL;

export default function SessionDetail() {
  // useParams() is the correct way to get route params in client components
  // It reads synchronously from the router context - no async issues
  const params = useParams();
  const sessionId = params?.id as string;

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [translateExport, setTranslateExport] = useState(true);
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'topic' | 'subtopic'>('subtopic');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/api/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSession(res.data);
    } catch (error: any) {
      console.error("Failed to fetch session", error);
      if (error?.response?.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      }
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchStatus = useCallback(async () => {
    if (!sessionId) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/api/sessions/${sessionId}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newStatus = res.data;
      
      setSession((prev: any) => {
        if (!prev) {
          fetchSession();
          return prev;
        }
        
        // If underlying progress changed, fetch full data
        if (
          prev.processed_patents !== newStatus.processed_patents ||
          prev.kyp_status !== newStatus.kyp_status ||
          prev.status !== newStatus.status
        ) {
          fetchSession();
        }
        
        // Always update the top-level numbers for the UI
        return {
          ...prev,
          processed_patents: newStatus.processed_patents,
          kyp_status: newStatus.kyp_status,
          status: newStatus.status,
          total_patents: newStatus.total_patents
        };
      });
    } catch (error) {
      console.error("Failed to poll status", error);
    }
  }, [sessionId, fetchSession]);

  // Initial fetch when sessionId is available
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Poll lightweight status endpoint every 2 seconds while processing
  useEffect(() => {
    if (session?.status !== 'processing') return;
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [session?.status, fetchStatus]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const loadingToast = toast.loading("Uploading file...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("token");
      const kypUserId = localStorage.getItem("user_id");
      await axios.post(`${API_BASE}/api/sessions/${sessionId}/upload`, formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`,
          "x-kyp-user-id": kypUserId || "1"
        }
      });
      toast.success("Upload successful! Processing started.", { id: loadingToast });
      fetchSession();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Upload failed", { id: loadingToast });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return (
    <div className="p-20 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
      <p className="text-slate-400 animate-pulse">Loading Session...</p>
    </div>
  );

  if (!session) return (
    <div className="p-20 text-center text-red-400">
      <p className="text-xl font-bold mb-2">Session not found.</p>
      <p className="text-sm text-slate-500 mb-4">Session ID: {sessionId}</p>
      <button onClick={() => router.push('/')} className="mt-4 text-indigo-400 hover:underline text-sm">
        ← Back to Sessions
      </button>
    </div>
  );

  const progressPercentage = session.total_patents > 0
    ? Math.round((session.processed_patents / session.total_patents) * 100)
    : 0;

  const handleExport = (translate: boolean) => {
    setShowExportModal(false);
    const token = localStorage.getItem("token");
    const exportToast = toast.loading(translate ? "Translating names & generating export..." : "Generating export...");
    
    // For downloads, we need to fetch via fetch/axios to pass headers, then create object url
    axios.get(`${API_BASE}/api/sessions/${sessionId}/export`, {
      params: { translate, sort_by: sortBy },
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob'
    }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // Get filename from content-disposition header if available, otherwise fallback
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${session?.name || 'session'}_export.xlsx`;
      if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
          filename = contentDisposition.split('filename=')[1].replace(/['"]/g, '');
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Export downloaded!", { id: exportToast });
    }).catch(error => {
      console.error("Export failed", error);
      toast.error("Failed to export session.", { id: exportToast });
    });
  };

  const handleCustomExport = (translate: boolean) => {
    if (selectedForExport.size === 0) {
      toast.error("Please select at least one patent.");
      return;
    }
    setShowExportModal(false);
    const exportToast = toast.loading(translate ? "Translating & Ranking..." : "Generating Ranked Export...");
    
    const token = localStorage.getItem("token");
    axios.post(`${API_BASE}/api/sessions/${sessionId}/export_custom`, {
      patent_ids: Array.from(selectedForExport),
      sort_by: sortBy
    }, {
      params: { translate },
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob'
    }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${session?.name || 'session'}_custom_export.xlsx`;
      if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
          filename = contentDisposition.split('filename=')[1].replace(/['"]/g, '');
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Custom Export downloaded!", { id: exportToast });
    }).catch(error => {
      console.error("Custom Export failed", error);
      toast.error("Failed to export custom session.", { id: exportToast });
    });
  };

  const handleToggleExport = (id: string) => {
    const next = new Set(selectedForExport);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedForExport(next);
  };

  return (
    <main className="w-full px-4 md:px-8 pt-12 pb-4">
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft size={16} /> Back to Sessions
      </button>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
            {session.name}
            {session.status === 'processing' && <RefreshCw size={20} className="text-indigo-400 animate-spin" />}
          </h1>
          <p className="text-slate-400 flex gap-4">
            <span>Status: <strong className="text-indigo-300 capitalize">{session.status}</strong></span>
            <span>Total Patents: <strong>{session.total_patents}</strong></span>
          </p>
        </div>

        <div className="flex gap-3 items-center w-full md:w-auto mt-4 md:mt-0">
          {(session.status === 'completed' || session.status === 'processing') && (
            <div className="flex flex-1 md:w-[280px] items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2.5 focus-within:border-indigo-500/50 transition-colors shadow-lg">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input 
                type="text" 
                placeholder="Search patents..." 
                className="bg-transparent border-none outline-none text-sm text-slate-300 w-full placeholder:text-slate-500"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
              />
            </div>
          )}
          {session.status === 'pending' && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                <UploadCloud size={20} />
                {uploading ? 'Uploading...' : 'Upload Excel'}
              </button>
            </>
          )}

          {(session.status === 'completed' || session.status === 'processing') && (
            <button
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-emerald-600/20 border border-emerald-500/30"
              onClick={() => setShowExportModal(true)}
            >
              <Download size={20} />
              Export Excel
            </button>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      {session.status === 'processing' && (
        <>
        <div className="mb-8 glass-panel p-6 rounded-xl flex flex-col md:flex-row gap-8">
          
          {/* Celery Progress */}
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2 font-medium">
              <span className="text-indigo-300">Data Enrichment (AI/Perplexity)</span>
              <span className="text-slate-300">{session.processed_patents} / {session.total_patents} ({progressPercentage}%)</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* KYP Batch Progress */}
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2 font-medium">
              <span className="text-amber-300">KYP Batch Scoring</span>
              <span className="text-slate-300 capitalize">{session.kyp_status || 'Pending'}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
              {session.kyp_status === 'completed' ? (
                 <div className="bg-emerald-500 h-3 w-full" />
              ) : session.kyp_status === 'processing' || session.kyp_status === 'pending' ? (
                 <div className="bg-gradient-to-r from-amber-500/60 to-amber-400 h-3 w-full animate-pulse" />
              ) : session.kyp_status === 'error' ? (
                 <div className="bg-rose-500 h-3 w-full" />
              ) : (
                 <div className="bg-slate-700 h-3 w-full" />
              )}
            </div>
          </div>
          
        </div>

        {/* KYP waiting banner — only shown when Celery is 100% done but KYP is still running */}
        {progressPercentage === 100 && session.kyp_status !== 'completed' && session.kyp_status !== 'error' && (
          <div className="mb-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 text-amber-300 text-sm">
            <svg className="animate-spin h-4 w-4 shrink-0 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 0v4a8 8 0 00-8 8H4z"></path>
            </svg>
            <span>
              <strong>Patent data enrichment is complete!</strong> KYP batch scoring is still running in the background — scores will appear automatically when finished. Please do not close this tab.
            </span>
          </div>
        )}
        </>
      )}

      {/* Empty State */}
      {session.status === 'pending' && (
        <div className="glass-panel rounded-xl border border-dashed border-slate-600 p-20 text-center">
          <UploadCloud size={48} className="mx-auto text-indigo-400 mb-4" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">Upload your Patent List</h3>
          <p className="text-slate-400 max-w-md mx-auto mb-6">
            Upload an Excel (.xlsx) file containing patent numbers in the first column to begin the automated analysis pipeline.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
          >
            Click to Browse Files
          </button>
        </div>
      )}

      {/* Results Table */}
      {(session.status === 'processing' || session.status === 'completed') && (
        <div className="glass-panel rounded-xl overflow-hidden shadow-2xl">
          {(() => {
            const patentsList = session.patents || [];
            const filteredPatents = patentsList.filter((p: any) => 
              p.patent_number?.toLowerCase().includes(globalSearch.toLowerCase()) || 
              p.title?.toLowerCase().includes(globalSearch.toLowerCase()) ||
              (p.assignees && p.assignees.join(' ').toLowerCase().includes(globalSearch.toLowerCase()))
            );
            return <ResultsTable 
              patents={filteredPatents} 
              selectedForExport={selectedForExport}
              onToggleExport={handleToggleExport}
              onSelectAll={() => {
                const exportable = filteredPatents.filter((p: any) => p.status !== 'pending' && p.status !== 'failed');
                if (selectedForExport.size === exportable.length && exportable.length > 0) {
                  setSelectedForExport(new Set());
                } else {
                  setSelectedForExport(new Set(exportable.map((p: any) => p.patent_number)));
                }
              }}
              sortBy={sortBy}
              onSortByChange={setSortBy}
            />;
          })()}
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl max-w-sm w-full relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-2">{selectedForExport.size > 0 ? "Custom Export" : "Export Configuration"}</h3>
            <p className="text-slate-400 text-sm mb-6">
              {selectedForExport.size > 0 
                ? `You have selected ${selectedForExport.size} patent(s). They will be ranked by ${sortBy === 'topic' ? 'Topic' : 'Subtopic'}.`
                : "Would you like to translate foreign company names (Assignees, Competitors) to English?"}
            </p>
            
            <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors mb-6">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                checked={translateExport}
                onChange={(e) => setTranslateExport(e.target.checked)}
              />
              <div>
                <div className="text-white font-medium">Translate to English</div>
                <div className="text-xs text-slate-500">Uses AI to translate Chinese/Japanese names</div>
              </div>
            </label>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => selectedForExport.size > 0 ? handleCustomExport(translateExport) : handleExport(translateExport)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-medium transition-all"
              >
                <Download size={16} />
                Download Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
