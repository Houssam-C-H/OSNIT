import React from 'react';
import { useCaseStore } from '../../store/useCaseStore';

// Lucide icons or raw SVGs can be used. We'll use raw SVGs for zero dependencies or standard Feather-like SVGs.
const icons = {
  shieldCheck: <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>,
  notes: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>,
  graph: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>, // Simplified network/zap icon
  dossier: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path></svg>,
  import: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>,
  extract: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>,
  export: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>,
  lock: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
};

export const NavRail: React.FC = () => {
  const { addTab, activeTabId, setGraphViewOpen, isGraphViewOpen } = useCaseStore();

  const handleNav = (type: 'MARKDOWN' | 'IMPORT' | 'EXTRACT' | 'EXPORT' | 'GRAPH' | 'DOSSIER', title: string) => {
    if (type === 'GRAPH') {
      setGraphViewOpen(true);
    } else {
      setGraphViewOpen(false);
      addTab({ id: type.toLowerCase(), type: type as any, title });
    }
  };

  const isActive = (type: string) => {
    if (type === 'GRAPH') return isGraphViewOpen;
    return activeTabId === type.toLowerCase() && !isGraphViewOpen;
  };

  const NavButton = ({ id, icon, label }: { id: string, icon: React.ReactNode, label: string }) => (
    <button
      onClick={() => handleNav(id as any, label)}
      title={label}
      className={`w-full flex justify-center py-3 relative text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition ${
        isActive(id) ? 'text-emerald-400 bg-slate-800' : ''
      }`}
    >
      {isActive(id) && (
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-emerald-500" />
      )}
      {icon}
    </button>
  );

  return (
    <nav className="w-14 bg-slate-950 border-r border-slate-800 flex flex-col items-center h-full z-20 shadow-xl flex-shrink-0">
      
      {/* Brand / Vault Status */}
      <div className="py-4 border-b border-slate-800 w-full flex justify-center mb-2" title="Vault Unlocked">
        {icons.shieldCheck}
      </div>

      {/* Main Tools */}
      <div className="flex-1 w-full flex flex-col gap-1">
        <NavButton id="MARKDOWN" icon={icons.notes} label="Notes & Wiki" />
        <NavButton id="DOSSIER" icon={icons.dossier} label="Target Dossiers" />
        <NavButton id="GRAPH" icon={icons.graph} label="Link Analysis Graph" />
        <NavButton id="IMPORT" icon={icons.import} label="Bulk CSV Importer" />
        <NavButton id="EXTRACT" icon={icons.extract} label="Regex Auto-Extractor" />
        <NavButton id="EXPORT" icon={icons.export} label="Case Packaging & Export" />
      </div>

      {/* Bottom Utilities */}
      <div className="w-full flex flex-col border-t border-slate-800">
        <button 
          title="Emergency Lock / Wipe Memory"
          className="w-full flex justify-center py-4 text-red-500/70 hover:text-red-400 hover:bg-red-950/30 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"></path></svg>
        </button>
      </div>
    </nav>
  );
};
