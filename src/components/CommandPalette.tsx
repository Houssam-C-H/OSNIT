import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCaseStore } from '../store/useCaseStore';

interface EntityPreview {
  id: string;
  entity_type: string;
  primary_name: string;
}

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityPreview[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { addTab } = useCaseStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle palette on CMD+K or CTRL+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      
      if (isOpen && e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // Debounce the Tauri IPC call to prevent spamming SQLite
    const timer = setTimeout(async () => {
      try {
        const res: EntityPreview[] = await invoke('search_entities', { query });
        setResults(res);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Search IPC failed:", err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Arrow key navigation through results
  useEffect(() => {
    const handleNavigation = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleNavigation);
    return () => window.removeEventListener('keydown', handleNavigation);
  }, [isOpen, results, selectedIndex]);

  const handleSelect = (entity: EntityPreview) => {
    // Open the entity dashboard in a new tab via Zustand
    addTab({
      id: `entity-${entity.id}`,
      type: 'ENTITY',
      title: entity.primary_name,
      dataId: entity.id,
    });
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-700 flex items-center">
          <svg className="w-5 h-5 text-slate-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder-slate-500 font-mono"
            placeholder="Search targets or aliases..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300 text-xs font-mono uppercase tracking-widest border border-slate-700 px-2 py-1 rounded">
            ESC
          </button>
        </div>

        {/* Results List */}
        {results.length > 0 && (
          <ul className="max-h-96 overflow-y-auto">
            {results.map((entity, idx) => (
              <li
                key={entity.id}
                onClick={() => handleSelect(entity)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-4 cursor-pointer flex items-center justify-between border-l-2 transition-colors ${
                  idx === selectedIndex
                    ? 'border-emerald-500 bg-slate-800'
                    : 'border-transparent hover:bg-slate-800/50'
                }`}
              >
                <div className="font-mono text-sm text-slate-200">{entity.primary_name}</div>
                <div className="text-xs uppercase tracking-widest text-emerald-500/70 font-semibold">{entity.entity_type}</div>
              </li>
            ))}
          </ul>
        )}
        
        {/* Empty State */}
        {query.trim() !== '' && results.length === 0 && (
          <div className="p-8 text-center text-slate-500 font-mono text-sm">
            No active targets found matching "{query}"
          </div>
        )}
      </div>
    </div>
  );
};
