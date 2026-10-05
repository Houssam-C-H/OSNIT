import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCaseStore } from '../../store/useCaseStore';

export const WorkspaceManager: React.FC = () => {
  const { isWorkspaceModalOpen, setWorkspaceModalOpen, currentWorkspace, setWorkspace } = useCaseStore();
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchWorkspaces = async () => {
    try {
      const list = await invoke<string[]>('list_workspaces');
      // Filter out internal non-case DBs if necessary, but list_workspaces just lists .db files
      setWorkspaces(list.filter(w => w !== 'osint_case_manager')); 
    } catch (err: any) {
      console.error(err);
      setError(err.toString());
    }
  };

  useEffect(() => {
    if (isWorkspaceModalOpen) {
      fetchWorkspaces();
    }
  }, [isWorkspaceModalOpen]);

  const handleOpenWorkspace = async (name: string) => {
    setLoading(true);
    setError('');
    try {
      await invoke('open_workspace', { name });
      setWorkspace(name);
      
      // Close tabs because we switched to a completely separate database
      useCaseStore.setState({ activeTabs: [], activeTabId: null, isGraphViewOpen: false });
      
      setWorkspaceModalOpen(false);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    
    // Creating a workspace is functionally identical to opening it (SQLite auto-creates missing DBs)
    await handleOpenWorkspace(newWorkspaceName.trim());
    setNewWorkspaceName('');
  };

  // If the user has NO workspace selected and the app just booted, we force the modal open
  useEffect(() => {
    if (currentWorkspace === null) {
      setWorkspaceModalOpen(true);
    }
  }, [currentWorkspace, setWorkspaceModalOpen]);

  if (!isWorkspaceModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-6 relative">
        {currentWorkspace !== null && (
          <button 
            onClick={() => setWorkspaceModalOpen(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        )}
        
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-100 flex items-center justify-center gap-2">
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
            Case File Manager
          </h2>
          <p className="text-slate-400 text-sm mt-1">Select an encrypted investigation file to open, or create a new one.</p>
        </div>

        {error && <div className="text-red-400 bg-red-950/50 p-2 rounded text-sm">{error}</div>}

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Available Case Files</h3>
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            {workspaces.length === 0 ? (
              <div className="text-slate-500 text-sm italic py-4 text-center">No cases found on disk. Create one below.</div>
            ) : (
              workspaces.map(w => (
                <button
                  key={w}
                  disabled={loading}
                  onClick={() => handleOpenWorkspace(w)}
                  className={`w-full flex items-center justify-between p-3 rounded border transition-colors ${
                    currentWorkspace === w 
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-400' 
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-750'
                  }`}
                >
                  <span className="font-mono">{w}</span>
                  {currentWorkspace === w ? <span className="text-xs font-bold bg-emerald-900 px-2 py-1 rounded">ACTIVE</span> : <span className="text-slate-500">→</span>}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <form onSubmit={handleCreateWorkspace} className="flex gap-2">
            <input 
              type="text"
              placeholder="E.g., OP_RED_SHIELD"
              value={newWorkspaceName}
              onChange={e => setNewWorkspaceName(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button 
              type="submit"
              disabled={loading || !newWorkspaceName.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-bold transition disabled:opacity-50"
            >
              Create File
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
