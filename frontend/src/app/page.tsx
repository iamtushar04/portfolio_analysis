"use client";
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, FolderOpen, ArrowRight, Trash2, LogOut, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { config } from '../config';

export default function Home() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<{id: string, name: string} | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const router = useRouter();

  useEffect(() => {
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

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${config.API_URL}/api/sessions/`, getHeaders());
      setSessions(res.data);
    } catch (error: any) {
      console.error("Failed to fetch sessions", error);
      if (error?.response?.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  };

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
      fetchSessions(); // Re-fetch on error to sync state
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-8 pt-20">
      {/* Absolute positioned top-right utility nav */}
      <div className="absolute top-8 right-8">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/50 px-4 py-2 rounded-lg transition-all text-sm font-medium border border-transparent hover:border-red-500/20"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>

      <header className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            Patent Portfolio Analysis
          </h1>
          <p className="text-slate-400 mt-2">Manage and analyze your patent collections seamlessly.</p>
        </div>
        
        <button 
          onClick={() => {
            setNewSessionName(`Session ${new Date().toLocaleDateString()}`);
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20"
        >
          <Plus size={20} />
          New Session
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((s: any) => (
            <div 
              key={s.id} 
              onClick={() => router.push(`/sessions/${s.id}`)}
              className="glass-panel p-6 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <FolderOpen size={24} />
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    s.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                    s.status === 'processing' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-slate-500/10 text-slate-400'
                  }`}>
                    {s.status.toUpperCase()}
                  </span>
                  <button
                    onClick={(e) => confirmDeleteSession(e, s.id, s.name)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                    title="Delete Session"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <h3 className="text-xl font-bold mb-1 group-hover:text-indigo-300 transition-colors">{s.name}</h3>
              <p className="text-sm text-slate-400 mb-6">
                Created on {new Date(s.created_at).toLocaleDateString()}
              </p>
              
              <div className="flex justify-between items-center text-sm border-t border-slate-700 pt-4">
                <span className="text-slate-300 font-medium">
                  {s.processed_patents} / {s.total_patents} Patents
                </span>
                <ArrowRight size={16} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
              </div>
            </div>
          ))}
          
          {sessions.length === 0 && (
            <div className="col-span-full py-20 text-center glass-panel rounded-xl">
              <FolderOpen size={48} className="mx-auto text-slate-500 mb-4" />
              <h3 className="text-xl font-medium text-slate-300 mb-2">No Sessions Yet</h3>
              <p className="text-slate-400">Create a new session to start analyzing patents.</p>
            </div>
          )}
        </div>
      )}

      {/* Create Session Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}>
          <div 
            className="glass-panel max-w-md w-full p-6 rounded-2xl shadow-2xl border border-slate-700/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-200">Create New Session</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={executeCreateSession}>
              <div className="mb-6">
                <label htmlFor="sessionName" className="block text-sm font-medium text-slate-400 mb-2">
                  Session Name
                </label>
                <input
                  id="sessionName"
                  type="text"
                  autoFocus
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                  placeholder="e.g. Q3 Telecomm Patents"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!newSessionName.trim()}
                  className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 transition-all"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSessionToDelete(null)}>
          <div 
            className="glass-panel max-w-sm w-full p-6 rounded-2xl shadow-2xl border border-slate-700/60"
            onClick={(e) => e.stopPropagation()} // Prevent clicking inside modal from closing it
          >
            <h3 className="text-xl font-bold text-slate-200 mb-2">Delete Session?</h3>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              Are you sure you want to permanently delete <span className="text-indigo-300 font-semibold">"{sessionToDelete.name}"</span>? This will instantly stop all background processing and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-rose-600/90 hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition-colors"
              >
                Delete Session
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
