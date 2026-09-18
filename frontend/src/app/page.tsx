"use client";
import React, { useState } from 'react';
import { Plus, FolderOpen, LogOut, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
 import { GetSessions } from '@/services/GetSessions';
import SessionCard from '@/components/ui/SessionCard';
import { ClipLoader } from 'react-spinners';
import { useQuery } from '@tanstack/react-query';
import { CreateSession } from '@/services/CreateSession';
import { DeleteSession } from '@/services/DeleteSession';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export default function Home() {
  const [sessionToDelete, setSessionToDelete] = useState<{id: string, name: string} | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const router = useRouter();
  const {
  data,
  isLoading,
  isError,
  error,
  refetch
} = useQuery({
  queryKey: ["sessions"],
  queryFn: GetSessions,
});



const queryClient = useQueryClient();

const deleteMutaion = useMutation({
  mutationFn: DeleteSession,

  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ["sessions"]
    });
    toast.success("Session deleted")
  },
  onError: (error) => {
    toast.error(error.message)
  }
});

const createMutaion = useMutation({
  mutationFn: CreateSession,

  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ["sessions"]
    })
  },
  onError: (error) => {
    toast.error(error.message);
  }

})
  
if (isError) {
  toast.error(error.message)
}
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.setItem("isAuth", "false");
    router.push("/login");
  };


  const executeCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    
    setIsCreateModalOpen(false);
    const loadingToast = toast.loading('Creating session...');
    
    try {
      const res = await CreateSession(newSessionName.trim());
      if (res && res.id) {
        toast.success('Session created successfully!', { id: loadingToast });
        refetch();
        router.push(`/sessions/${res.id}`);
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

  

  return (
    <main className="min-h-screen bg-white text-slate-100 px-6 py-10 relative">

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
      
      bg-#b90000
      
      border
      border-slate-300
      
      shadow-sm
      
      hover:bg-slate-100
      active:bg-slate-200
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
    <header className="flex flex-col md:flex-row justify-between md:items-end gap-6">

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
          bg-red-100
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
          createMutaion.mutate(data.id)
          setIsCreateModalOpen(true);
        }}
        className="
        flex items-center justify-center gap-2
        px-3 py-2
        rounded-xl
        text-slate-700
        bg-#b90000
        border border-slate-200
        hover:bg-slate-100
        active:bg-slate-200
        shadow-sm
        hover:shadow-md
        transition
        font-semibold
        cursor-pointer"
      >
        <Plus size={20}/>
        New Session
      </button>


    </header>




    {/* Loader */}
    {isLoading ? (

      <div className="flex justify-center py-32">

        <ClipLoader size={25} color='red'/>

      </div>


    ) : (



      <div
className="
mt-5
grid
grid-cols-1
md:grid-cols-2
xl:grid-cols-3
gap-7 animate-fadeIn
"
>

{
data.map((s:any)=>(

<SessionCard
    key={s.id}
    session={s}
    onDelete={() => deleteMutaion.mutate(s.id)}
    onClick={()=>router.push(`/sessions/${s.id}`)}
/>

))

}




        {data.length === 0 && (
  <section className="flex items-center justify-center mt-5 min-h-[30vh]">
    <div
      className="
        w-full
        
        py-24
        rounded-2xl

        bg-white
        border
        border-slate-200
        text-center
      "
    >
      <FolderOpen
        size={55}
        className="
          mx-auto
          text-slate-600
          mb-5
        "
      />

      <h3
        className="
          text-xl
          font-semibold
          text-slate-500
        "
      >
        No Sessions Yet
      </h3>

      <p
        className="
          text-slate-400
          mt-2
        "
      >
        Create a new session to start analyzing patents.
      </p>
    </div>
  </section>
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
        bg-white
        border
        border-slate-200
        rounded-2xl
        p-7
        shadow-2xl">


          <div className="
          flex
          justify-between
          items-center
          mb-6">


            <h3 className="text-xl text-slate-700 font-bold">
              Create New Session
            </h3>


            <button
            onClick={()=>setIsCreateModalOpen(false)}
            className="text-slate-700 hover:text-slate-800 cursor-pointer">
              <X size={20}/>
            </button>


          </div>



          <form onSubmit={executeCreateSession}>


            <label className="
            text-sm
            text-slate-700">
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
            bg-gray-300
            
            focus-within:ring-2
            focus-within:ring-slate-700
            outline-none text-slate-700"
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
              text-slate-700
              hover:bg-slate-200
              bg-white">
                Cancel
              </button>


              <button
              type="submit"
              disabled={!newSessionName.trim()}
              className="
              px-6
              py-2
              rounded-lg
              bg-white
              text-slate-800
              hover:bg-slate-200
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



            {/* <button
            onClick={executeDelete}
            className="
            px-5
            py-2
            rounded-lg
            bg-red-600
            hover:bg-red-500">
              Delete Session
            </button> */}


          </div>


        </div>


      </div>

    )}



  </div>

</main>
  );
}