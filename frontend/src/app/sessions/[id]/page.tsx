"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { UploadCloud, ArrowLeft, RefreshCw, Download } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
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

  // Initial fetch when sessionId is available
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Poll every 3 seconds while processing
  useEffect(() => {
    if (session?.status !== 'processing') return;
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [session?.status, fetchSession]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE}/api/sessions/${sessionId}/upload`, formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`
        }
      });
      fetchSession();
    } catch (error: any) {
      alert(error.response?.data?.detail || "Upload failed");
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

  const handleExport = () => {
    const token = localStorage.getItem("token");
    
    // For downloads, we need to fetch via fetch/axios to pass headers, then create object url
    axios.get(`${API_BASE}/api/sessions/${sessionId}/export`, {
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
    }).catch(error => {
      console.error("Export failed", error);
      alert("Failed to export session.");
    });
  };

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-8 pt-12">
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

        <div className="flex gap-3">
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
              onClick={handleExport}
            >
              <Download size={20} />
              Export Excel
            </button>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      {session.status === 'processing' && (
        <div className="mb-8 glass-panel p-6 rounded-xl">
          <div className="flex justify-between text-sm mb-2 font-medium">
            <span className="text-indigo-300">Processing Patents...</span>
            <span className="text-slate-300">{session.processed_patents} / {session.total_patents} ({progressPercentage}%)</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
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
          <ResultsTable patents={session.patents} />
        </div>
      )}
    </main>
  );
}
