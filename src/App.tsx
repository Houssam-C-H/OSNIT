import { useCaseStore } from './store/useCaseStore';
import { CommandPalette } from './components/CommandPalette';
import { DossierView } from './components/dossier/DossierView';
import { EditorWorkspace } from './components/editor/EditorWorkspace';
import { BulkImporter } from './components/BulkImporter';
import { AutoExtractor } from './components/AutoExtractor';
import { SecureExport } from './components/SecureExport';
import { NetworkGraph } from './components/NetworkGraph';
import { NavRail } from './components/layout/NavRail';
import { CreateEntityModal } from './components/modals/CreateEntityModal';
import { WorkspaceManager } from './components/modals/WorkspaceManager';
import { MockDataGenerator } from './components/MockDataGenerator';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface VaultStats {
  entity_count: number;
  relationship_count: number;
  attachment_count: number;
}

function App() {
  const {
    activeTabs,
    activeTabId,
    isGraphViewOpen,
    currentWorkspace,
    setWorkspaceModalOpen
  } = useCaseStore();

  const [vaultStats, setVaultStats] = useState<VaultStats>({ entity_count: 0, relationship_count: 0, attachment_count: 0 });

  // Live footer stats — refresh every time workspace changes or every 10s
  useEffect(() => {
    const fetchStats = () => {
      invoke<VaultStats>('get_vault_stats')
        .then(setVaultStats)
        .catch(() => {}); // Silently fail if DB not ready
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [currentWorkspace, activeTabId]);

  const renderActiveTab = () => {
    const activeTab = activeTabs.find(t => t.id === activeTabId);
    if (!activeTab) return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
        <svg className="w-16 h-16 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p className="text-lg">No active workspace.</p>
        <p className="text-sm">Click a tool on the left or press <kbd className="bg-slate-800 px-2 py-1 rounded text-emerald-400 font-mono">Ctrl + K</kbd> to search entities.</p>
      </div>
    );

    switch (activeTab.type as string) {
      case 'ENTITY':
      case 'DOSSIER':
        return <DossierView />;
      case 'MARKDOWN':
        return <EditorWorkspace />;
      case 'IMPORT':
        return <BulkImporter />;
      case 'EXTRACT':
        return <AutoExtractor />;
      case 'EXPORT':
        return <SecureExport />;
      default:
        return <div>Unknown tab type</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col h-screen overflow-hidden">
      <CommandPalette />
      <CreateEntityModal />
      <WorkspaceManager />
      <MockDataGenerator />

      {/* Global Shell Header */}
      <header className="bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 py-2 text-xs font-mono tracking-wide z-10">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-200 tracking-widest flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            OSINT CASE VAULT
          </span>
          <span className="text-slate-500 px-4 border-l border-slate-800 flex items-center gap-2">
            Active Case:
            <button
              onClick={() => setWorkspaceModalOpen(true)}
              className="text-emerald-400 font-bold hover:text-emerald-300 transition underline decoration-emerald-900 underline-offset-4 cursor-pointer"
            >
              {currentWorkspace ? currentWorkspace.toUpperCase() : 'NO FILE SELECTED'}
            </button>
          </span>
        </div>

        <div className="text-slate-500">
          <kbd className="bg-slate-900 border border-slate-800 px-2 py-1 rounded">CMD+K</kbd> Search
        </div>

        <div className="text-slate-500 border-l border-slate-800 pl-4">
          Status: <span className="text-emerald-500 font-bold border border-emerald-900/50 bg-emerald-950/30 px-2 py-1 rounded">[AIR-GAPPED]</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <NavRail />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative bg-slate-950">
          {isGraphViewOpen ? (
            <NetworkGraph />
          ) : (
            <div className="h-full overflow-y-auto custom-scrollbar">
              {renderActiveTab()}
            </div>
          )}
        </main>
      </div>

      {/* Live Status Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 flex items-center justify-between px-4 py-1 text-[10px] font-mono text-slate-600 z-10">
        <span>DB: <span className="text-emerald-500">Encrypted (SQLCipher)</span></span>
        <span>Targets: <span className="text-slate-400">{vaultStats.entity_count.toLocaleString()}</span></span>
        <span>Links: <span className="text-slate-400">{vaultStats.relationship_count.toLocaleString()}</span></span>
        <span>Evidence Files: <span className="text-slate-400">{vaultStats.attachment_count.toLocaleString()}</span></span>
        <span className="text-emerald-600">● Live</span>
      </footer>
    </div>
  );
}

export default App;