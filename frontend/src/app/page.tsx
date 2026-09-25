"use client";
import React, { useState, useEffect } from "react";
import { Plus, FolderOpen, LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { GetSessions } from "@/services/GetSessions";
import SessionCard from "@/components/ui/SessionCard";
import { ClipLoader } from "react-spinners";
import { useQuery } from "@tanstack/react-query";
import { CreateSession } from "@/services/CreateSession";
import { DeleteSession } from "@/services/DeleteSession";
import { useMutation, useQueryClient } from "@tanstack/react-query";
const Home = () => {
  const [sessionToDelete, setSessionToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["sessions"],
    queryFn: GetSessions,
  });

  const deleteMutation = useMutation({
  mutationFn: DeleteSession,

  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ["sessions"],
    });

    toast.success("Session deleted successfully");
    setSessionToDelete(null);
  },

  onError: (error: any) => {
    toast.error(error.message || "Failed to delete session");
  },
});

  const createMutaion = useMutation({
    mutationFn: CreateSession,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["sessions"],
      });
      toast.success("Session created Successfully");
    },
    onError: () => {
      toast.error("Something went wrong");
    },
  });

  useEffect(() => {
    if (isError) {
      toast.error("Something went wrong");
    }
  }, [isError]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.setItem("isAuth", "false");
    router.push("/login");
  };

  const executeCreateSession = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newSessionName.trim()) return;

    setIsCreateModalOpen(false);

    createMutaion.mutate(newSessionName.trim());
  };

  return (
    <>

  {/* Fixed Header */}
  <header
    className="
      sticky top-0
      z-[100]
      bg-white
      border-b
      border-slate-200
      shadow-sm
      px-6
      py-4
      flex
      flex-col
      md:flex-row
      justify-between
      md:items-end
      gap-6
    "
  >
          <div className="absolute top-8 right-7 z-50">
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
      
      text-slate-100
      
      bg-[#b90000]
      
      border
      border-slate-300
      
      shadow-sm
      
      hover:bg-red-700
      active:bg-red-800
      hover:shadow-md
      
      cursor-pointer
      
      transition
    "
            >
              <LogOut size={18} />
            </button>
          </div>

          <div>
            <div className="flex gap-3 mb-3">
              <div
                className="
          w-12 h-12
          rounded-2xl
          bg-[#b90000]
          flex items-center justify-center
          shadow-sm shadow-slate-500
          "
              >
                <FolderOpen size={25} color="white" />
              </div>

              <span
                className="
          px-3 py-1
          rounded-full
          text-xs
          flex-col place-content-center
          bg-[#b90000]
          text-gray-100
          font-semibold
          border border-indigo-500/20
          "
              >
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
        "
            >
              Patent Portfolio Analysis
            </h1>

            <p className="mt-3 text-slate-600 w-full">
              Manage, monitor and analyze your patent collections through
              intelligent portfolio insights.
            </p>
          </div>

          <button
            onClick={() => {
              setIsCreateModalOpen(true);
            }}
            className="
        flex items-center justify-center gap-2
        px-3 py-2
        rounded-xl
        text-slate-100
        bg-[#b90000]
        border border-slate-200
        hover:bg-red-700
        active:bg-red-800
        shadow-sm
        hover:shadow-md
        transition
        font-semibold
        cursor-pointer"
          >
            <Plus size={20} />
            New Session
          </button>
        </header>

        <main className="min-h-screen bg-slate-100 text-slate-100 px-6 py-10 relative">

      <div className="max-w-7xl mx-auto relative">
        
        {/* Loader */}
        {isLoading ? (
          <div className="flex justify-center py-32">
            <ClipLoader size={25} color="red" />
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
            {data.map((s: any) => (
  <SessionCard
    key={s.id}
    session={s}
    onDelete={() =>
      setSessionToDelete({
        id: s.id,
        name: s.name,
      })
    }
    onClick={() => router.push(`/sessions/${s.id}`)}
  />
))}

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
      z-[999]
      flex
      items-center
      justify-center
      bg-black/70
      backdrop-blur-md
      p-5"
            onClick={() => setIsCreateModalOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="
        w-full
        max-w-md
        bg-white
        border
        border-slate-200
        rounded-2xl
        p-7
        shadow-2xl"
            >
              <div
                className="
          flex
          justify-between
          items-center
          mb-6"
              >
                <h3 className="text-xl text-slate-700 font-bold">
                  Create New Session
                </h3>

                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-700 hover:text-slate-800 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={executeCreateSession}>
                <label
                  className="
            text-sm
            text-slate-700"
                >
                  Session Name
                </label>

                <input
                  autoFocus
                  id="sessionName"
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="
            mt-2
            w-full
            px-4
            py-3
            rounded-xl
            bg-gray-300
            
            focus-within:ring-2
            focus-within:ring-slate-700
            outline-none text-slate-700 transition"
                  placeholder="e.g. Q3 Telecomm Patents"
                  required
                />

                <div
                  className="
            flex
            justify-end
            gap-3
            mt-7"
                >
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="
              px-4
              py-2
              rounded-lg
              text-slate-700
              hover:bg-slate-200
              bg-white cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={!newSessionName.trim()}
                    className="
              px-4
              py-2
              rounded-lg
              text-slate-700
              hover:bg-slate-200
              bg-white cursor-pointer"
                  >
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
      z-[999]
      flex
      items-center
      justify-center
      bg-black/60
      backdrop-blur-sm
      p-5
    "
    onClick={() => setSessionToDelete(null)}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="
        w-full
        max-w-md
        bg-white
        rounded-2xl
        border
        border-slate-200
        p-7
        shadow-2xl
      "
    >

      <h3
        className="
          text-xl
          font-semibold
          text-slate-800
          mb-3
        "
      >
        Delete Session?
      </h3>


      <p
        className="
          text-sm
          text-slate-600
          leading-relaxed
          mb-7
        "
      >
        Are you sure you want to delete{" "}
        <span className="font-semibold text-red-600">
          "{sessionToDelete.name}"
        </span>
        ?
        <br />
        This action cannot be undone.
      </p>


      <div className="flex justify-end gap-3">

        <button
          type="button"
          onClick={() => setSessionToDelete(null)}
          className="
            px-5
            py-2
            rounded-lg
            border
            border-slate-300
            text-slate-700
            hover:bg-slate-100
            transition
            cursor-pointer
          "
        >
          Cancel
        </button>


        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={() =>
            deleteMutation.mutate(sessionToDelete.id)
          }
          className="
            px-5
            py-2
            rounded-lg
            bg-red-600
            text-white
            hover:bg-red-700
            transition
            cursor-pointer
            disabled:opacity-50
          "
        >
          {deleteMutation.isPending
            ? "Deleting..."
            : "Confirm Delete"}
        </button>

      </div>

    </div>
  </div>
)}
      </div>
    </main>
    </>
  );
};
export default Home;
