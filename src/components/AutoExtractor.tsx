import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ExtractionMatch {
  source_entity_id: string;
  source_entity_name: string;
  matched_type: string;
  matched_value: string;
  already_exists: boolean;
}

interface ExtractionStats {
  new_entities: number;
  new_links: number;
}

const TYPE_COLORS: Record<string, string> = {
  ip_address: 'text-red-400 bg-red-950/40 border-red-900',
  email: 'text-blue-400 bg-blue-950/40 border-blue-900',
  crypto_wallet: 'text-amber-400 bg-amber-950/40 border-amber-900',
};

export const AutoExtractor: React.FC = () => {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'review' | 'committing' | 'done' | 'error'>('idle');
  const [previewMatches, setPreviewMatches] = useState<ExtractionMatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<ExtractionStats | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handlePreview = async () => {
    try {
      setPhase('scanning');
      setPreviewMatches([]);
      setStats(null);
      setErrorMessage('');
      const matches = await invoke<ExtractionMatch[]>('preview_auto_extraction');
      setPreviewMatches(matches);
      // Pre-select new (non-duplicate) matches
      const defaultSelected = new Set(
        matches.map((_, i) => i).filter(i => !matches[i].already_exists)
      );
      setSelectedIds(defaultSelected);
      setPhase('review');
    } catch (err: any) {
      setPhase('error');
      setErrorMessage(err.toString());
    }
  };

  const handleCommit = async () => {
    try {
      setPhase('committing');
      const result = await invoke<ExtractionStats>('run_auto_extraction');
      setStats(result);
      setPhase('done');
    } catch (err: any) {
      setPhase('error');
      setErrorMessage(err.toString());
    }
  };

  const toggleSelect = (idx: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const newCount = previewMatches.filter(m => !m.already_exists).length;
  const dupeCount = previewMatches.filter(m => m.already_exists).length;

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-[calc(100vh-100px)] bg-slate-950 text-slate-300 font-mono text-sm overflow-y-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2 uppercase tracking-wider flex items-center gap-3">
        <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        Automated Intelligence Extractor
      </h1>
      <p className="text-slate-500 mb-8 text-xs leading-relaxed">
        Scans all encrypted text attributes for hidden IoCs.
        Detects <span className="text-red-400 font-semibold">IPv4 Addresses</span>,{' '}
        <span className="text-blue-400 font-semibold">Email Addresses</span>, and{' '}
        <span className="text-amber-400 font-semibold">Crypto Wallets (BTC/ETH)</span>.
        <br />
        <span className="text-emerald-400 font-semibold">Step 1: Preview</span> — review matches before committing to the vault.
      </p>

      {/* Phase: IDLE */}
      {phase === 'idle' && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center shadow-xl">
          <p className="text-slate-400 mb-6">Run a dry-scan to preview all discoverable indicators before any changes are made.</p>
          <button
            onClick={handlePreview}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-4 px-10 rounded-lg tracking-widest uppercase transition shadow-lg cursor-pointer"
          >
            Scan &amp; Preview
          </button>
        </div>
      )}

      {/* Phase: SCANNING */}
      {phase === 'scanning' && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-emerald-400 font-bold tracking-widest">Scanning Database...</p>
        </div>
      )}

      {/* Phase: REVIEW */}
      {phase === 'review' && (
        <div className="flex flex-col gap-4">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-slate-100">{previewMatches.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">Total Matches</div>
            </div>
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{newCount}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">New Entities</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-slate-500">{dupeCount}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">Already Exist</div>
            </div>
          </div>

          {previewMatches.length === 0 ? (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center text-slate-500">
              No extractable indicators found in the database.
            </div>
          ) : (
            <>
              {/* Select all / deselect */}
              <div className="flex gap-3 items-center px-1">
                <button onClick={() => setSelectedIds(new Set(previewMatches.map((_, i) => i)))} className="text-xs text-emerald-400 hover:text-emerald-300 transition">Select All</button>
                <span className="text-slate-700">|</span>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-slate-300 transition">Deselect All</button>
                <span className="text-slate-700">|</span>
                <button onClick={() => setSelectedIds(new Set(previewMatches.map((_, i) => i).filter(i => !previewMatches[i].already_exists)))} className="text-xs text-amber-400 hover:text-amber-300 transition">Select New Only</button>
                <span className="ml-auto text-slate-500 text-xs">{selectedIds.size} selected</span>
              </div>

              {/* Match list */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950">
                      <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase tracking-widest w-8"></th>
                      <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase tracking-widest">Type</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase tracking-widest">Value</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase tracking-widest">Found In</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {previewMatches.map((match, idx) => (
                      <tr
                        key={idx}
                        onClick={() => toggleSelect(idx)}
                        className={`cursor-pointer transition ${selectedIds.has(idx) ? 'bg-emerald-950/20' : 'hover:bg-slate-800/40'} ${match.already_exists ? 'opacity-50' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(idx)}
                            onChange={() => toggleSelect(idx)}
                            className="accent-emerald-500 cursor-pointer"
                            onClick={e => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${TYPE_COLORS[match.matched_type] || 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                            {match.matched_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-200">{match.matched_value}</td>
                        <td className="px-3 py-2 text-slate-400 truncate max-w-[160px]" title={match.source_entity_name}>{match.source_entity_name}</td>
                        <td className="px-3 py-2">
                          {match.already_exists
                            ? <span className="text-slate-500 text-[10px]">Duplicate</span>
                            : <span className="text-emerald-400 text-[10px] font-bold">New</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-end mt-2">
                <button onClick={() => setPhase('idle')} className="px-6 py-2 text-slate-400 hover:text-slate-200 transition text-sm font-bold">
                  ← Re-scan
                </button>
                <button
                  onClick={handleCommit}
                  disabled={selectedIds.size === 0}
                  className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-2 px-8 rounded-lg tracking-widest uppercase transition shadow-lg cursor-pointer text-sm"
                >
                  Commit {selectedIds.size} Matches to Vault
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Phase: COMMITTING */}
      {phase === 'committing' && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-emerald-400 font-bold tracking-widest">Writing to Encrypted Vault...</p>
        </div>
      )}

      {/* Phase: DONE */}
      {phase === 'done' && stats && (
        <div className="bg-emerald-900/20 border border-emerald-500/50 rounded-xl p-8 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
          <h3 className="text-emerald-400 font-bold text-lg mb-6 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Extraction Complete
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-950/50 border border-slate-800 rounded p-4 text-center">
              <div className="text-3xl font-bold text-slate-100 mb-1">{stats.new_entities.toLocaleString()}</div>
              <div className="text-slate-500 text-xs uppercase tracking-widest">New Entities Created</div>
            </div>
            <div className="bg-slate-950/50 border border-slate-800 rounded p-4 text-center">
              <div className="text-3xl font-bold text-slate-100 mb-1">{stats.new_links.toLocaleString()}</div>
              <div className="text-slate-500 text-xs uppercase tracking-widest">New Links Generated</div>
            </div>
          </div>
          <button onClick={() => { setPhase('idle'); setStats(null); }} className="w-full text-center text-emerald-400 hover:text-emerald-300 text-sm transition">
            Run Another Extraction
          </button>
        </div>
      )}

      {/* Phase: ERROR */}
      {phase === 'error' && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 text-red-400">
          <h3 className="font-bold mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Engine Fault Detected
          </h3>
          <p className="text-sm break-words">{errorMessage}</p>
          <button onClick={() => setPhase('idle')} className="mt-4 text-slate-400 hover:text-slate-200 text-xs transition">← Reset</button>
        </div>
      )}
    </div>
  );
};
