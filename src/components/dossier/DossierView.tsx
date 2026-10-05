import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { EntityDashboard } from './EntityDashboard';
import { useCaseStore } from '../../store/useCaseStore';
import { EntityCategory } from '../../types/intelligence';

const CATEGORY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'person', label: '👤 Person' },
  { value: 'company', label: '🏢 Company' },
  { value: 'organization', label: '🏛️ Organization' },
  { value: 'phone', label: '📞 Phone' },
  { value: 'email', label: '✉️ Email' },
  { value: 'social', label: '🌐 Social' },
  { value: 'ip_address', label: '💻 IP Address' },
  { value: 'domain', label: '🌍 Domain' },
  { value: 'crypto_wallet', label: '₿ Crypto' },
  { value: 'bank_account', label: '🏦 Bank' },
  { value: 'location', label: '📍 Location' },
  { value: 'vehicle', label: '🚗 Vehicle' },
  { value: 'passport', label: '🛂 Passport' },
];

const PAGE_SIZE = 50;

export const DossierView = () => {
  const [entities, setEntities] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const { activeTabId, setModalOpen, currentWorkspace } = useCaseStore();
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [fullEntity, setFullEntity] = useState<any>(null);
  const [isLoadingEntity, setIsLoadingEntity] = useState(false);

  // Sync selected target from tab system
  useEffect(() => {
    if (activeTabId && activeTabId.startsWith('entity-')) {
      setSelectedEntityId(activeTabId.replace('entity-', ''));
    }
  }, [activeTabId]);

  // Paginated + filtered entity fetch
  const fetchEntities = useCallback(async (reset = false) => {
    const currentPage = reset ? 0 : page;
    try {
      const data: any[] = await invoke('search_entities_paginated', {
        query: search,
        entityTypeFilter: categoryFilter,
        offset: currentPage * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      if (reset) {
        setEntities(data);
        setPage(0);
      } else {
        setEntities(prev => [...prev, ...data]);
      }
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    }
  }, [search, categoryFilter, page]);

  useEffect(() => {
    fetchEntities(true);
  }, [search, categoryFilter, currentWorkspace]);

  // Load full entity data using get_entity_full — FIXES THE #1 BUG
  useEffect(() => {
    if (!selectedEntityId) {
      setFullEntity(null);
      return;
    }
    setIsLoadingEntity(true);
    invoke('get_entity_full', { id: selectedEntityId })
      .then((data: any) => {
        if (!data) { setFullEntity(null); return; }
        setFullEntity({
          id: data.id,
          type: data.entity_type.toLowerCase() as EntityCategory,
          primary_name: data.primary_name,
          created_at: data.created_at,
          updated_at: data.updated_at,
          // Real attributes from DB
          attributes: data.attributes.map((a: any) => ({ key: a.key, value: a.value })),
          // Real relationships from DB  
          relationships: data.relationships.map((r: any) => ({
            target_id: r.target_id,
            target_name: r.target_name,
            target_type: r.target_type,
            relationship_type: r.is_incoming ? `← ${r.relationship_type}` : r.relationship_type,
          })),
          // Real attachments from DB
          attachments: data.attachments.map((a: any) => ({
            original_filename: a.original_filename,
            size_bytes: a.size_bytes,
            hash: a.file_hash,
            mime_type: a.mime_type,
            created_at: a.created_at,
          })),
        });
      })
      .catch(console.error)
      .finally(() => setIsLoadingEntity(false));
  }, [selectedEntityId]);

  const handleEntityUpdated = () => {
    // Refresh both the entity detail and the list
    if (selectedEntityId) {
      invoke('get_entity_full', { id: selectedEntityId }).then((data: any) => {
        if (data) setFullEntity({
          id: data.id,
          type: data.entity_type.toLowerCase() as EntityCategory,
          primary_name: data.primary_name,
          created_at: data.created_at,
          updated_at: data.updated_at,
          attributes: data.attributes.map((a: any) => ({ key: a.key, value: a.value })),
          relationships: data.relationships.map((r: any) => ({
            target_id: r.target_id,
            target_name: r.target_name,
            target_type: r.target_type,
            relationship_type: r.is_incoming ? `← ${r.relationship_type}` : r.relationship_type,
          })),
          attachments: data.attachments.map((a: any) => ({
            original_filename: a.original_filename,
            size_bytes: a.size_bytes,
            hash: a.file_hash,
            mime_type: a.mime_type,
          })),
        });
      });
      fetchEntities(true);
    }
  };

  return (
    <div className="flex h-full w-full bg-slate-950 overflow-hidden">

      {/* Target Directory Sidebar */}
      <div className="w-72 border-r border-slate-800 bg-slate-900/40 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-slate-800 flex flex-col gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="w-full bg-emerald-900/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-800 py-2 rounded font-bold transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Create Target
          </button>

          {/* Search */}
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input
              type="text"
              placeholder="Search targets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded py-2 pl-9 pr-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none transition"
            />
          </div>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded py-1.5 px-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none transition"
          >
            {CATEGORY_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Entity count */}
        <div className="px-3 py-1.5 border-b border-slate-800/50 flex justify-between items-center">
          <span className="text-[10px] text-slate-500 font-mono">{entities.length} targets loaded</span>
          {hasMore && (
            <button
              onClick={() => { setPage(p => p + 1); fetchEntities(); }}
              className="text-[10px] text-emerald-500 hover:text-emerald-400 transition font-bold"
            >
              Load more
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
          {entities.map(entity => (
            <button
              key={entity.id}
              onClick={() => setSelectedEntityId(entity.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg flex flex-col gap-0.5 transition border-l-2 ${
                selectedEntityId === entity.id
                  ? 'bg-slate-800 border-emerald-500 text-emerald-100'
                  : 'hover:bg-slate-800/60 text-slate-300 border-transparent'
              }`}
            >
              <div className="font-bold text-sm truncate">{entity.primary_name}</div>
              <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">{entity.entity_type}</div>
            </button>
          ))}
          {entities.length === 0 && (
            <div className="text-center text-slate-600 text-sm italic mt-8">No targets found.</div>
          )}
        </div>
      </div>

      {/* Main Dossier Panel */}
      <div className="flex-1 bg-slate-950 overflow-y-auto custom-scrollbar relative">
        {isLoadingEntity && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 z-10">
            <div className="flex items-center gap-3 text-emerald-400 font-mono text-sm">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Loading Dossier...
            </div>
          </div>
        )}
        {fullEntity ? (
          <EntityDashboard entity={fullEntity} onEntityUpdated={handleEntityUpdated} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <svg className="w-16 h-16 mb-4 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <p className="text-lg">Select a target from the directory</p>
            <p className="text-sm mt-2">or create a new dossier to begin analysis.</p>
          </div>
        )}
      </div>
    </div>
  );
};
