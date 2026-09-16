"use client";
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, FolderOpen, ArrowRight, Trash2, LogOut, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { config } from '../config';
 import { GetSessions } from '@/apis/GetSessions';
import SessionCard from '@/components/ui/SessionCard';
import { ClipLoader } from 'react-spinners';
export default function Home() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<{id: string, name: string} | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const router = useRouter();


  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true)
      const response = await GetSessions();
      setSessions(response.data)
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.setItem("isAuth", "false");
    router.push("/login");
  };

  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
  });


  const executeCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    
    setIsCreateModalOpen(false);
    const loadingToast = toast.loading('Creating session...');
    
    try {
      const res = await axios.post(`${config.API_URL}/api/sessions/?name=${encodeURIComponent(newSessionName.trim())}`, {}, getHeaders());
      if (res.data && res.data.id) {
        toast.success('Session created successfully!', { id: loadingToast });
        router.push(`/sessions/${res.data.id}`);
      } else {
        toast.error('Session created but ID missing', { id: loadingToast });
      }
    } catch (error: any) {
      toast.error('Failed to create session', { id: loadingToast });
      if (error?.response?.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      }
    }
  };

  const confirmDeleteSession = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation(); // prevent navigation
    setSessionToDelete({ id, name });
  };

  const executeDelete = async () => {
    if (!sessionToDelete) return;
    const { id } = sessionToDelete;
    setSessionToDelete(null); // Close modal instantly

    // Optimistic UI update: instantly remove from screen
    setSessions(prev => prev.filter((s: any) => s.id !== id));
    
    try {
      await axios.delete(`${config.API_URL}/api/sessions/${id}`, getHeaders());
      toast.success('Session deleted');
    } catch (error: any) {
      console.error("Failed to delete session", error);
      toast.error("Failed to delete session");
      if (error?.response?.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      }
      // fetchSessions(); // Re-fetch on error to sync state
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-red-400 text-slate-100 px-6 py-10 relative">

  <div className="absolute top-8 right-8 z-50">
  <button
    type="button"
    onClick={handleLogout}
    className="
      flex
      items-center
      justify-center
      
      w-10
      h-10
      
      rounded-xl
      
      text-slate-800
      
      bg-gradient-to-r
      from-red-200
      to-purple-300
      
      border
      border-slate-300
      
      shadow-sm
      
      hover:from-red-300
      hover:to-purple-400
      
      hover:shadow-md
      
      cursor-pointer
      
      transition
    "
  >
    <LogOut size={18}/>
  </button>
</div>


  <div className="max-w-7xl mx-auto relative">


    {/* Header */}
    <header className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-12">

      <div>

        <div className="flex gap-3 mb-3">

          <div className="
          w-12 h-12
          rounded-2xl
          bg-gradient-to-br
          from-red-500
          to-purple-600
          flex items-center justify-center
          shadow-sm shadow-red-500
          ">
            <FolderOpen size={25}/>
          </div>


          <span className="
          px-3 py-1
          rounded-full
          text-xs
          flex-col place-content-center
          bg-red-500/10
          text-gray-800
          border border-indigo-500/20
          ">
            IP Intelligence Platform
          </span>

        </div>


        <h1
        className="
        text-2xl
        font-semibold
        bg-gradient-to-r
        from-gray-600
        to-gray-600
        text-transparent
        bg-clip-text
        ">
          Patent Portfolio Analysis
        </h1>


        <p className="mt-3 text-slate-700 max-w-xl">
          Manage, monitor and analyze your patent collections through intelligent portfolio insights.
        </p>


      </div>



      <button
        onClick={() => {
          setNewSessionName(`Session ${new Date().toLocaleDateString()}`);
          setIsCreateModalOpen(true);
        }}
        className="
        flex items-center justify-center gap-2
        px-6 py-3
        rounded-xl
        bg-gradient-to-r
        from-red-500
        to-purple-500
        hover:from-purple-600
        hover:to-red-600
        shadow-lg
        shadow-red-600/30
        transition
        hover:shadow-md
        font-semibold
        cursor-pointer"
      >
        <Plus size={20}/>
        New Session
      </button>


    </header>




    {/* Loader */}
    {loading ? (

      <div className="flex justify-center py-32">

        <ClipLoader size={25} color='red'/>

      </div>


    ) : (



      <div
className="
grid
grid-cols-1
md:grid-cols-2
xl:grid-cols-3
gap-7
"
>

{
sessions.map((s:any)=>(

<SessionCard
    key={s.id}
    session={s}
    onDelete={confirmDeleteSession}
    onClick={()=>router.push(`/sessions/${s.id}`)}
/>

))

}




        {sessions.length===0 && (

          <div
          className="
          py-24
          rounded-2xl
          bg-gradient-to-b from-white to-green-300
          border
          border-slate-800
          text-center">


            <FolderOpen
            size={55}
            className="
            mx-auto
            text-slate-600
            mb-5"/>


            <h3
            className="
            text-xl
            font-semibold">
              No Sessions Yet
            </h3>


            <p
            className="
            text-slate-400
            mt-2">
              Create a new session to start analyzing patents.
            </p>


          </div>

        )}


      </div>


    )}







    {/* CREATE SESSION MODAL */}
    {isCreateModalOpen && (

      <div
      className="
      fixed
      inset-0
      z-50
      flex
      items-center
      justify-center
      bg-black/70
      backdrop-blur-md
      p-5"
      onClick={()=>setIsCreateModalOpen(false)}>


        <div
        onClick={(e)=>e.stopPropagation()}
        className="
        w-full
        max-w-md
        bg-slate-900
        border
        border-slate-700
        rounded-2xl
        p-7
        shadow-2xl">


          <div className="
          flex
          justify-between
          items-center
          mb-6">


            <h3 className="text-xl font-bold">
              Create New Session
            </h3>


            <button
            onClick={()=>setIsCreateModalOpen(false)}
            className="text-slate-400 hover:text-white">
              <X size={20}/>
            </button>


          </div>



          <form onSubmit={executeCreateSession}>


            <label className="
            text-sm
            text-slate-400">
              Session Name
            </label>


            <input
            autoFocus
            id="sessionName"
            type="text"
            value={newSessionName}
            onChange={(e)=>setNewSessionName(e.target.value)}
            className="
            mt-2
            w-full
            px-4
            py-3
            rounded-xl
            bg-slate-800
            border
            border-slate-700
            focus:ring-2
            focus:ring-indigo-500
            outline-none"
            placeholder="e.g. Q3 Telecomm Patents"
            required
            />


            <div className="
            flex
            justify-end
            gap-3
            mt-7">


              <button
              type="button"
              onClick={()=>setIsCreateModalOpen(false)}
              className="
              px-4
              py-2
              rounded-lg
              bg-slate-800
              hover:bg-slate-700">
                Cancel
              </button>


              <button
              type="submit"
              disabled={!newSessionName.trim()}
              className="
              px-6
              py-2
              rounded-lg
              bg-indigo-600
              hover:bg-indigo-500
              disabled:opacity-50">
                Create
              </button>


            </div>


          </form>


        </div>


      </div>

    )}






    {/* DELETE CONFIRMATION MODAL */}
    {sessionToDelete && (

      <div
      className="
      fixed
      inset-0
      z-50
      flex
      items-center
      justify-center
      bg-black/70
      backdrop-blur-md
      p-5"
      onClick={()=>setSessionToDelete(null)}>


        <div
        onClick={(e)=>e.stopPropagation()}
        className="
        max-w-sm
        w-full
        bg-slate-900
        border
        border-slate-700
        rounded-2xl
        p-7">


          <h3 className="text-xl font-bold mb-3">
            Delete Session?
          </h3>


          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Are you sure you want to permanently delete 
            <span className="text-indigo-300 font-semibold">
              "{sessionToDelete.name}"
            </span>?
            This will instantly stop all background processing and cannot be undone.
          </p>



          <div className="flex justify-end gap-3">


            <button
            onClick={()=>setSessionToDelete(null)}
            className="
            px-4
            py-2
            rounded-lg
            bg-slate-800
            hover:bg-slate-700">
              Cancel
            </button>



            <button
            onClick={executeDelete}
            className="
            px-5
            py-2
            rounded-lg
            bg-red-600
            hover:bg-red-500">
              Delete Session
            </button>


          </div>


        </div>


      </div>

    )}



  </div>

</main>
  );
}
