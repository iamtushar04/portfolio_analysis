"use client";
import React, { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, ArrowLeft, RefreshCw, Download, Search } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import ResultsTable from '../../../components/PatentDetails/ResultsTable';
import { config } from '../../../config';
import { BarLoader } from 'react-spinners';
import { useQuery } from "@tanstack/react-query";
import { GetSessionById } from "../../../services/GetSessionById";
import ExcelPreview from '@/components/excel/ExcelPreview';
import { FileSpreadsheet } from "lucide-react";
const API_BASE = config.API_URL;

export default function SessionDetail() {
  // useParams() is the correct way to get route params in client components
  // It reads synchronously from the router context - no async issues
  const params = useParams();
  const sessionId = params?.id as string;

  // const [session, setSession] = useState<any>(null);
  // const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [translateExport, setTranslateExport] = useState(true);
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'topic' | 'subtopic'>('subtopic');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { data, isLoading, isError, refetch, error } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => GetSessionById(sessionId),
  })

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
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Upload failed", { id: loadingToast });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) return (
    <main className="min-h-screen flex justify-center items-center bg-white">
      <div className='flex flex-col gap-5'>
      <span><BarLoader color='red'/></span>
      <p className="text-slate-700 font-semibold animate-pulse">Loading Session...</p>
      </div>
    </main>
  );
  if (isError) {
    toast.error(error.message)
  }

  if (!data) return (
    <main className='min-h-screen bg-white flex justify-center items-center'>
    <div className="p-20 text-center text-red-400">
      <p className="text-xl font-bold mb-2">Session not found.</p>
      <p className="text-sm text-slate-500 mb-4">Session ID: {sessionId}</p>
  
      <button onClick={() => router.push('/')} className="cursor-pointer flex items-center justify-center  gap-2 mt-4 text-gray-700 px-2 py-3 bg-white hover:underline text-sm">
      <ArrowLeft size={15} color='red'/> 
      <span>Back to Sessions</span>
      </button>
    </div>
    </main>
  );

  const progressPercentage = data.total_patents > 0
    ? Math.round((data.processed_patents / data.total_patents) * 100)
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
      let filename = `${data.name || 'session'}_export.xlsx`;
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
      let filename = `${data?.name || 'session'}_custom_export.xlsx`;
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
    <>
    
    <main className='w-full bg-white px-4 md:px-8 pt-5 pb-4'>
      <header className="bg-white mx-auto container w-full px-4 md:px-8 py-1">
  <div className="rounded-2xl bg-white shadow-md px-4 py-3">

    <div className="flex flex-col lg:flex-row items-center justify-between gap-3">

      {/* Left Section */}
      <div className="flex items-center gap-4">

        {/* Back Button */}
        <button
          onClick={() => router.push("/")}
          className="
            flex gap-2 justify-center items-center
            text-sm font-medium
            text-slate-700
            border border-slate-200
            bg-white
            hover:bg-slate-100
            active:bg-slate-200
            transition
            px-3 py-1.5
            rounded-lg
            cursor-pointer
          "
        >
          <ArrowLeft size={16} color="red" />
          Back
        </button>


        {/* Session Info */}
        <div className="flex items-center gap-3">

          <h1 className="text-2xl font-semibold text-gray-600 bg-white px-2 rounded-xl py-1">
            {data.name}
          </h1>


          {data.status === "processing" && (
            <RefreshCw
              size={20}
              className="text-yellow-400 animate-spin"
            />
          )}


          {/* Status */}
          <span
            className="
              flex items-center gap-2
              px-3 py-1
              rounded-full
              bg-white
              text-sm
              text-slate-500
            "
          >
            Status:

            <strong
              className={`
                capitalize
                ${
                  data.status === "completed"
                    ? "text-emerald-600"
                    : data.status === "processing"
                    ? "text-yellow-500"
                    : "text-red-400"
                }
              `}
            >
              {data.status}
            </strong>

          </span>


          {/* Patent Count */}
          <span
            className="
              flex items-center gap-2
              px-3 py-1
              rounded-full
              bg-white
              text-sm
              text-slate-500
            "
          >
            Patents:

            <strong className="text-slate-500">
              {data.total_patents}
            </strong>

          </span>

        </div>

      </div>



      {/* Right Section */}
      <div className="flex items-center gap-3">


        {/* Search */}
        {(data.status === "completed" ||
          data.status === "processing") && (

          <div
            className="
              flex items-center gap-2
              bg-slate-200
              border border-slate-300
              rounded-xl
              foucs-within:ring-1 focus-within:ring-red-300
              px-3 py-2
              w-[260px]
            "
          >

            <Search size={16} className="text-slate-700"/>

            <input
              type="text"
              placeholder="Search patents..."
              className="
                bg-transparent
                outline-none
                text-sm
                text-slate-500
                w-full
                placeholder:text-slate-500
              "
              value={globalSearch}
              onChange={(e)=>setGlobalSearch(e.target.value)}
            />

          </div>

        )}



        {/* Upload */}
        {data.status === "pending" && (

          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls"
              className="hidden"
            />

            <button
              onClick={()=>fileInputRef.current?.click()}
              disabled={uploading}
              className="
                flex items-center gap-2
                bg-emerald-500
                hover:bg-emerald-600
                active:bg-emerald-700
                text-white
                px-4 py-2
                rounded-xl
                font-medium
                transition
                cursor-pointer
              "
            >
              <UploadCloud size={18}/>

              {uploading ? "Uploading..." : "Upload"}

            </button>
          </>

        )}
      <ExcelPreview sessionId={sessionId}/>


        {/* Export */}
        

      </div>

    </div>

  </div>
</header>
<section className='mx-auto container'>
      {/* Progress Bar */}
      {data.status === 'processing' && (
        <div className="mb-8 bg-white p-6 rounded-xl">
          <div className="flex justify-between text-sm mb-2 font-medium">
            <span className="text-slate-700">Processing Patents...</span>
            <span className="text-slate-600">{data.processed_patents} / {data.total_patents} ({progressPercentage}%)</span>
          </div>

          {/* KYP Batch Progress */}
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2 font-medium">
              <span className="text-amber-600">KYP Batch Scoring</span>
              <span className="text-slate-500 capitalize">{data.kyp_status || 'Pending'}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
              {data.kyp_status === 'completed' ? (
                 <div className="bg-emerald-700 h-3 w-full" />
              ) : data.kyp_status === 'processing' || data.kyp_status === 'pending' ? (
                 <div className="bg-gradient-to-r from-salte-500 to-salte-700 h-3 w-full animate-pulse" />
              ) : data.kyp_status === 'error' ? (
                 <div className="bg-rose-500 h-3 w-full" />
              ) : (
                 <div className="bg-slate-700 h-3 w-full" />
              )}
            </div>
          </div>
          
        </div>
      )}
      </section>
      <section className='mx-auto container'>
      {/* Empty State */}
      {data.status === 'pending' && (
        <div className='min-h-screen pt-5'>
        <div className="bg-white rounded-xl border border-dashed border-slate-600 p-20 text-center">
          <UploadCloud size={48} className="mx-auto text-slate-500 mb-4" />
          <h3 className="text-xl font-medium text-slate-500 mb-2">Upload your Patent List</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            Upload an Excel (.xlsx) file containing patent numbers in the first column to begin the automated analysis pipeline.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-slate-500 hover:text-slate-600 font-medium hover:underline cursor-pointer"
          >
            Click to Browse Files
          </button>
        </div>
        </div>
      )}
      </section>
      <section className='mx-auto container'>
      {/* Results Table */}
      <div className='min-h-screen pt-5'>
      {(data.status === 'processing' || data.status === 'completed') && (
        <div className="glass-panel rounded-xl overflow-hidden shadow-2xl">
          {(() => {
            const patentsList = data.patents || [];
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
      </div>

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
      </section>
      </main>
      </>
  );
}
