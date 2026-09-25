"use client";
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  UploadCloud,
  ArrowLeft,
  RefreshCw,
  Download,
  Search,
  FileSpreadsheet,
  ShieldAlert,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import PatentDetails from "@/components/patentdetails";
import { config } from "@/config";
import { BarLoader, ClipLoader } from "react-spinners";
import { useQuery } from "@tanstack/react-query";
import { GetSessionById } from "@/services/GetSessionById";
import ExcelPreview from "@/components/ExcelPreview";
import InfringementDrawer from "@/components/InfringementDrawer";

const API_BASE = config.API_URL;

export default function SessionDetail() {
  const params = useParams();
  const sessionId = params?.id as string;

  const [uploading, setUploading] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [translateExport, setTranslateExport] = useState(true);
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(
    new Set(),
  );
  const [sortBy, setSortBy] = useState<"topic" | "subtopic">("subtopic");

  const [infringementJobs, setInfringementJobs] = useState<Map<string, { job_id: string; status: string; result?: any }>>(new Map());
  const [openInfringementDrawer, setOpenInfringementDrawer] = useState<{ patent_number: string; result: any } | null>(null);
  const [isInstructionModalOpen, setIsInstructionModalOpen] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [targetPatentId, setTargetPatentId] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { data, isLoading, isError, refetch, error } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => GetSessionById(sessionId),
    enabled: !!sessionId, // FIX: don't fire the query before the id exists
    // FIX: poll while processing so the progress bar / KYP status update live
    refetchInterval: (query) =>
      (query.state.data as any)?.status === "processing" ? 5000 : false,
  });

  // FIX: toasts are side effects — must not run during render
  useEffect(() => {
    if (isError && error) toast.error(error.message);
  }, [isError, error]);


  // On load: restore already-cached infringement results from the DB
  useEffect(() => {
    if (!data?.patents) return;

    // 1. Restore completed jobs
    const cachedPatents = data.patents.filter(
      (p: any) => p.has_cached_infringement && !infringementJobs.has(p.patent_number)
    );

    // 2. Restore running jobs
    const runningPatents = data.patents.filter(
      (p: any) => p.running_infringement_job_id && !infringementJobs.has(p.patent_number)
    );

    if (runningPatents.length > 0) {
      runningPatents.forEach((p: any) => {
        setInfringementJobs(prev => {
          const next = new Map(prev);
          next.set(p.patent_number, {
            job_id: p.running_infringement_job_id,
            status: 'running',
          });
          return next;
        });
      });
    }

    if (cachedPatents.length === 0) return;

    const token = localStorage.getItem('token');
    cachedPatents.forEach(async (p: any) => {
      try {
        const res = await axios.post(`${API_BASE}/api/sessions/infringement/start`, {
          patent_number: p.patent_number,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.status === 'completed') {
          setInfringementJobs(prev => {
            const next = new Map(prev);
            next.set(p.patent_number, {
              job_id: res.data.job_id,
              status: 'completed',
              result: res.data.result,
            });
            return next;
          });
        }
      } catch (e) {
        console.warn(`Could not restore cached infringement for ${p.patent_number}`, e);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.patents]);

  // Poll running infringement jobs every 5 seconds
  useEffect(() => {
    const runningJobs = Array.from(infringementJobs.entries()).filter(([_, job]) => job.status === 'running');
    if (runningJobs.length === 0) return;

    const interval = setInterval(async () => {
      const token = localStorage.getItem("token");
      for (const [patentId, job] of runningJobs) {
        try {
          const res = await axios.get(`${API_BASE}/api/sessions/infringement/${job.job_id}/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.data && res.data.status !== 'running') {
            setInfringementJobs(prev => {
              const next = new Map(prev);
              next.set(patentId, { job_id: job.job_id, status: res.data.status, result: res.data.result || res.data.message });
              return next;
            });
            if (res.data.status === 'completed') {
              toast.success(`Infringement Analysis completed for ${patentId}!`);
            } else {
              toast.error(`Infringement Analysis failed for ${patentId}.`);
            }
          }
        } catch (e) {
          console.error(`Failed to poll infringement job ${job.job_id}`, e);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [infringementJobs]);

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
      await axios.post(
        `${API_BASE}/api/sessions/${sessionId}/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
            "x-kyp-user-id": kypUserId || "1",
          },
        },
      );
      toast.success("Upload successful! Processing started.", {
        id: loadingToast,
      });
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Upload failed", {
        id: loadingToast,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // FIX: deduplicated download logic shared by both export handlers
  const downloadBlobResponse = (
    response: any,
    fallbackName: string,
    toastId: string,
    successMsg: string,
  ) => {
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;

    const contentDisposition = response.headers["content-disposition"];
    let filename = fallbackName;
    if (contentDisposition && contentDisposition.indexOf("filename=") !== -1) {
      filename = contentDisposition.split("filename=")[1].replace(/['"]/g, "");
    }

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success(successMsg, { id: toastId });
  };

  const handleExport = (translate: boolean) => {
    setShowExportModal(false);
    const exportToast = toast.loading(
      translate
        ? "Translating names & generating export..."
        : "Generating export...",
    );

    const token = localStorage.getItem("token");
    axios
      .get(`${API_BASE}/api/sessions/${sessionId}/export`, {
        params: { translate, sort_by: sortBy },
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      })
      .then((response) => {
        downloadBlobResponse(
          response,
          `${data?.name || "session"}_export.xlsx`,
          exportToast,
          "Export downloaded!",
        );
      })
      .catch((err) => {
        console.error("Export failed", err);
        toast.error("Failed to export session.", { id: exportToast });
      });
  };

  const handleCustomExport = (translate: boolean) => {
    if (selectedForExport.size === 0) {
      toast.error("Please select at least one patent.");
      return;
    }
    setShowExportModal(false);
    const exportToast = toast.loading(
      translate ? "Translating & Ranking..." : "Generating Ranked Export...",
    );

    const token = localStorage.getItem("token");
    axios
      .post(
        `${API_BASE}/api/sessions/${sessionId}/export_custom`,
        {
          patent_ids: Array.from(selectedForExport),
          sort_by: sortBy,
        },
        {
          params: { translate },
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      )
      .then((response) => {
        downloadBlobResponse(
          response,
          `${data?.name || "session"}_custom_export.xlsx`,
          exportToast,
          "Custom Export downloaded!",
        );
      })
      .catch((err) => {
        console.error("Custom Export failed", err);
        toast.error("Failed to export custom session.", { id: exportToast });
      });
  };

  const handleToggleExport = (id: string) => {
    const next = new Set(selectedForExport);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedForExport(next);
  };


  const openInfringementModal = (patentId: string) => {
    if (infringementJobs.has(patentId)) {
      const job = infringementJobs.get(patentId);
      if (job?.status === 'completed' && job.result) {
        setOpenInfringementDrawer({ patent_number: patentId, result: job.result });
        return;
      }
      if (job?.status === 'running') {
        toast.error("An infringement analysis is already running for this patent.");
        return;
      }
    }
    setTargetPatentId(patentId);
    setCustomInstruction("");
    setIsInstructionModalOpen(true);
  };

  const handleStartInfringement = async (patentId: string, customInstruction: string = "") => {
    const startToast = toast.loading("Starting Infringement Analysis...");
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE}/api/sessions/infringement/start`, {
        patent_number: patentId,
        custom_instruction: customInstruction || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.status === 'completed') {
        // Cache hit!
        toast.success("Analysis loaded from cache!", { id: startToast });
        setInfringementJobs(prev => {
          const next = new Map(prev);
          next.set(patentId, { job_id: res.data.job_id, status: 'completed', result: res.data.result });
          return next;
        });
        setOpenInfringementDrawer({ patent_number: patentId, result: res.data.result });
      } else {
        // New run
        toast.success("Analysis started! See the patent row for progress.", { id: startToast });
        setInfringementJobs(prev => {
          const next = new Map(prev);
          next.set(patentId, { job_id: res.data.job_id, status: 'running' });
          return next;
        });
      }
      setSelectedForExport(new Set()); // Deselect after starting
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to start analysis.", { id: startToast });
    }
  };

  // --- Loading state ---
  if (isLoading)
    return (
      <main className="min-h-screen flex justify-center items-center bg-white">
        <div className="flex flex-col gap-5 items-center">
          <ClipLoader color="red" />
          <p className="text-slate-700 font-semibold animate-pulse">
            Loading Session...
          </p>
        </div>
      </main>
    );

  // FIX: dedicated error screen instead of falling through and rendering "not found"
  if (isError)
    return (
      <main className="min-h-screen bg-white flex justify-center items-center">
        <div className="p-20 text-center text-red-400">
          <p className="text-xl font-bold mb-2">Failed to load session.</p>
          <p className="text-sm text-slate-500 mb-4">{error?.message}</p>
          <button
            onClick={() => router.push("/")}
            className="cursor-pointer flex items-center justify-center gap-2 mt-4 text-gray-700 px-2 py-3 bg-white hover:underline text-sm"
          >
            <ArrowLeft size={15} color="red" />
            <span>Back to Sessions</span>
          </button>
        </div>
      </main>
    );

  if (!data)
    return (
      <main className="min-h-screen bg-white flex justify-center items-center px-6">

  <div
    className="
      w-full
      max-w-md
      p-10
      text-center
      border
      border-slate-200
      rounded-xl
      shadow-sm
      bg-white
    "
  >

    <div
      className="
        w-16
        h-16
        mx-auto
        mb-5
        rounded-full
        bg-red-50
        flex
        items-center
        justify-center
      "
    >
      <span
        className="
          text-3xl
          font-bold
        "
        style={{
          color: "#b90000"
        }}
      >
        !
      </span>
    </div>


    <p
      className="
        text-xl
        font-bold
        mb-3
      "
      style={{
        color: "#b90000"
      }}
    >
      Session not found.
    </p>


    <p
      className="
        text-sm
        text-slate-500
        mb-6
      "
    >
      The requested session could not be found.
      <br />
      Session ID: {sessionId}
    </p>



    <button
      onClick={() => router.push("/")}
      className="
        cursor-pointer
        mx-auto
        flex
        items-center
        justify-center
        gap-2
        text-gray-700
        px-4
        py-2.5
        bg-white
        border
        border-slate-200
        rounded-md
        hover:underline
        text-sm
      "
    >

      <ArrowLeft
        size={15}
        color="#b90000"
      />

      <span>
        Back to Sessions
      </span>

    </button>


  </div>

</main>
    );

  const progressPercentage =
    data.total_patents > 0
      ? Math.round((data.processed_patents / data.total_patents) * 100)
      : 0;

  const patentsList: any[] = data.patents || [];
  const hasPatents = patentsList.length > 0;

  return (
    <main className="w-full bg-white px-4 md:px-8 pb-4">
      {/* ============ Header ============ */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200">
  <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3">

    <div className="
      flex flex-col xl:flex-row
      xl:items-center
      justify-between
      gap-4
    ">

      {/* LEFT SECTION */}
      <div className="
        flex flex-wrap
        items-center
        gap-3
        min-w-0
      ">

        {/* Back Button */}
        <button
          onClick={() => router.push("/")}
          className="
            flex items-center gap-2
            bg-[#b90000]
            hover:bg-red-700
            active:bg-red-800
            text-white
            px-3 py-2
            rounded-lg
            cursor-pointer
            text-sm
            font-medium
            transition
            shrink-0
          "
        >
          <ArrowLeft size={16}/>
          <span className="hidden sm:inline">
            Back
          </span>
        </button>


        {/* Session Name */}
        <div
          className="
            max-w-[220px]
            sm:max-w-[320px]
            truncate
            text-lg
            font-semibold
            text-slate-700
          "
          title={data.name}
        >
          {data.name}
        </div>


        {/* Processing */}
        {data.status === "processing" && (
          <RefreshCw
            size={18}
            className="text-amber-500 animate-spin shrink-0"
          />
        )}


        {/* Status */}
        <div
          className="
            flex items-center gap-2
            px-3 py-1.5
            rounded-full
            bg-slate-50
            border border-slate-200
            text-sm
            whitespace-nowrap
          "
        >
          <span className="text-slate-500">
            Status
          </span>

          <span
            className={`
              font-semibold capitalize
              ${
                data.status === "completed"
                ? "text-emerald-600"
                :
                data.status === "processing"
                ? "text-amber-500"
                :
                "text-red-500"
              }
            `}
          >
            {data.status}
          </span>
        </div>


        {/* Patent Count */}
        <div
          className="
            flex items-center gap-2
            px-3 py-1.5
            rounded-full
            bg-slate-50
            border border-slate-200
            text-sm
            whitespace-nowrap
          "
        >
          <span className="text-slate-500">
            Patents
          </span>

          <span className="font-semibold text-slate-700">
            {data.total_patents}
          </span>
        </div>

      </div>



      {/* RIGHT SECTION */}
      <div
        className="
          flex flex-wrap
          items-center
          gap-3
          w-full
          xl:w-auto
        "
      >


        {/* Search */}
        {(data.status === "completed" ||
          data.status === "processing") && (

          <div
            className="
              flex items-center gap-2
              bg-slate-100
              border border-slate-200
              rounded-xl
              px-3 py-2
              flex-1
              min-w-[220px]
              max-w-full
              xl:w-[260px]
              focus-within:ring-2
              focus-within:ring-red-100
            "
          >

            <Search
              size={16}
              className="text-slate-500 shrink-0"
            />

            <input
              type="text"
              placeholder="Search patents..."
              className="
                bg-transparent
                outline-none
                text-sm
                text-slate-700
                w-full
                placeholder:text-slate-400
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
                bg-emerald-600
                hover:bg-emerald-700
                text-white
                px-4 py-2
                rounded-xl
                text-sm
                cursor-pointer
                font-medium
                transition
                disabled:opacity-50
              "
            >

              <UploadCloud size={17}/>

              <span>
                {uploading
                  ? "Uploading..."
                  : "Upload"
                }
              </span>

            </button>
          </>

        )}


        {data.patents.length > 0 && (
        <ExcelPreview sessionId={sessionId}/>
        )}



        {/* Infringement Button */}
        {(data.status === "completed" ||
          data.status === "processing") && (

          <button
            className="
              flex items-center justify-center gap-2
              bg-[#b90000]
              hover:bg-red-700
              active:bg-red-800
              cursor-pointer
              text-white
              px-4
              sm:px-5
              py-2
              rounded-xl
              text-sm
              font-medium
              transition
              shadow-md
              shadow-red-200
              whitespace-nowrap
            "
            onClick={()=>{
              if(selectedForExport.size===0){
                toast.error(
                  "Please select a patent first."
                );
                return;
              }

              if(selectedForExport.size>1){
                toast.error(
                  "Please select only one patent for Infringement Analysis."
                );
                return;
              }

              const patentId =
                Array.from(selectedForExport)[0];

              openInfringementModal(patentId);
            }}
          >

            <ShieldAlert size={17}/>

            <span className="hidden sm:inline">
              Infringement Analysis
            </span>

            <span className="sm:hidden">
              Analysis
            </span>

          </button>

        )}

      </div>

    </div>

  </div>
</header>

      {/* ============ Processing Progress ============ */}
      <section className="mx-auto container">
        {data.status === "processing" && (
          // FIX: was a syntax error — two siblings inside "&&" plus an illegal "//" JSX
          // comment. Wrapped both in a Fragment and removed the bad comment.
          <>
            <div className="mb-8 bg-white p-6 rounded-xl">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-slate-700">Processing Patents...</span>
                <span className="text-slate-600">
                  {data.processed_patents} / {data.total_patents} (
                  {progressPercentage}%)
                </span>
              </div>

              {/* KYP Batch Progress */}
              <div className="flex-1 mt-4">
                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span className="text-amber-600">KYP Batch Scoring</span>
                  <span className="text-slate-500 capitalize">
                    {data.kyp_status || "Pending"}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                  {data.kyp_status === "completed" ? (
                    <div className="bg-emerald-700 h-3 w-full" />
                  ) : data.kyp_status === "processing" ||
                    data.kyp_status === "pending" ? (
                    // FIX: typo "salte" → "slate" (gradient classes were never applying)
                    <div className="bg-gradient-to-r from-slate-500 to-slate-700 h-3 w-full animate-pulse" />
                  ) : data.kyp_status === "error" ? (
                    <div className="bg-rose-500 h-3 w-full" />
                  ) : (
                    <div className="bg-slate-700 h-3 w-full" />
                  )}
                </div>
              </div>
            </div>

            {/* KYP waiting banner — only shown when Celery is 100% done but KYP is still running */}
            {progressPercentage === 100 &&
              data?.kyp_status !== "completed" &&
              data?.kyp_status !== "error" && (
                <div className="mb-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 text-amber-500 text-sm">
                  <svg
                    className="animate-spin h-4 w-4 shrink-0 text-amber-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 0v4a8 8 0 00-8 8H4z"
                    />
                  </svg>
                  <span>
                    <strong>Patent data enrichment is complete!</strong> KYP
                    batch scoring is still running in the background — scores
                    will appear automatically when finished. Please do not close
                    this tab.
                  </span>
                </div>
              )}
          </>
        )}
      </section>

      {/* ============ Empty State ============ */}
      <section className="bg-white fixed inset-0 flex items-center justify-center overflow-hidden">
  {data.status === "pending" && (
    <div className="w-full max-w-xl px-5">
      <div
        className="
          bg-white
          rounded-xl
          border
          border-dashed
          border-slate-300
          p-20
          text-center
          shadow-sm
        "
      >
        <UploadCloud
          size={48}
          className="mx-auto text-slate-500 mb-4"
        />

        <h3 className="text-xl font-medium text-slate-500 mb-2">
          Upload your Patent List
        </h3>

        <p className="text-slate-500 max-w-md mx-auto mb-6">
          Upload an Excel (.xlsx) file containing patent numbers in the
          first column to begin the automated analysis pipeline.
        </p>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="
            text-slate-500
            hover:text-slate-600
            font-medium
            hover:underline
            cursor-pointer
          "
        >
          Click to Browse Files
        </button>
      </div>
    </div>
  )}
</section>
      {/* ============ Results + Export Modal ============ */}
      <section className="mx-auto container">
        <div className="pt-5">
          {(data.status === "processing" || data.status === "completed") && (
            <div className="glass-panel rounded-xl overflow-hidden shadow-2xl">
              {(() => {
                const filteredPatents = patentsList.filter(
                  (p: any) =>
                    p.patent_number
                      ?.toLowerCase()
                      .includes(globalSearch.toLowerCase()) ||
                    p.title
                      ?.toLowerCase()
                      .includes(globalSearch.toLowerCase()) ||
                    (p.assignees &&
                      p.assignees
                        .join(" ")
                        .toLowerCase()
                        .includes(globalSearch.toLowerCase())),
                );
                return (
                  <PatentDetails
                    patents={filteredPatents}
                    selectedForExport={selectedForExport}
                    onToggleExport={handleToggleExport}
                    onSelectAll={() => {
                      const exportable = filteredPatents.filter(
                        (p: any) =>
                          p.status !== "pending" && p.status !== "failed",
                      );
                      if (
                        selectedForExport.size === exportable.length &&
                        exportable.length > 0
                      ) {
                        setSelectedForExport(new Set());
                      } else {
                        setSelectedForExport(
                          new Set(exportable.map((p: any) => p.patent_number)),
                        );
                      }
                    }}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    infringementJobs={infringementJobs}
                    onViewInfringement={(patent_number, result) => setOpenInfringementDrawer({ patent_number, result })}
                    onStartInfringement={openInfringementModal}
                  />
                );
              })()}
            </div>
          )}
        </div>

        {/* Instruction Modal */}
        {isInstructionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-100 border border-slate-700 p-6 rounded-xl shadow-2xl max-w-lg w-full relative animate-in fade-in zoom-in duration-200">
              <h3 className="text-xl font-bold text-slate-500 mb-2">Start Infringement Analysis</h3>
              <p className="text-slate-500 text-sm mb-4">
                Patent ID: <strong className="text-indigo-500">{targetPatentId}</strong>
              </p>
              
              <textarea
                className="w-full h-32 bg-slate-200 border border-slate-700 rounded-lg p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6 resize-none"
                placeholder="Enter custom instructions for the AI (Optional)...&#10;e.g., 'Focus specifically on the communication protocols.'"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
              ></textarea>
              
              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 rounded-lg font-medium text-slate-500 hover:bg-slate-200 transition cursor-pointer"
                  onClick={() => setIsInstructionModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg font-medium bg-[#b90000] hover:bg-red-800 text-white transition shadow-md shadow-indigo-500/20 cursor-pointer"
                  onClick={() => {
                    setIsInstructionModalOpen(false);
                    handleStartInfringement(targetPatentId, customInstruction);
                  }}
                >
                  Start Analysis
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl max-w-sm w-full relative">
              <h3 className="text-xl font-bold text-white mb-2">
                {selectedForExport.size > 0
                  ? "Custom Export"
                  : "Export Configuration"}
              </h3>
              <p className="text-slate-400 text-sm mb-6">
                {selectedForExport.size > 0
                  ? `You have selected ${selectedForExport.size} patent(s). They will be ranked by ${sortBy === "topic" ? "Topic" : "Subtopic"}.`
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
                  <div className="text-white font-medium">
                    Translate to English
                  </div>
                  <div className="text-xs text-slate-500">
                    Uses AI to translate Chinese/Japanese names
                  </div>
                </div>
              </label>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    selectedForExport.size > 0
                      ? handleCustomExport(translateExport)
                      : handleExport(translateExport)
                  }
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-medium transition-all cursor-pointer"
                >
                  <Download size={16} />
                  Download Excel
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Infringement Drawer */}
      <InfringementDrawer
        isOpen={openInfringementDrawer !== null}
        onClose={() => setOpenInfringementDrawer(null)}
        patentNumber={openInfringementDrawer?.patent_number || null}
        result={openInfringementDrawer?.result}
      />
    </main>
  );
}
