import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useCaseStore } from '../../store/useCaseStore';
import { EntityCategory } from '../../types/intelligence';
import { SVG_ASSETS, getLogoKey } from '../NetworkGraph';

const CONFIDENCE_TAGS = [
  { label: 'Confirmed', color: 'emerald' },
  { label: 'Suspected', color: 'amber' },
  { label: 'Unverified', color: 'slate' },
  { label: 'Priority', color: 'red' },
  { label: 'Archived', color: 'indigo' },
];

interface Attribute { key: string; value: string; }
interface Relationship { target_name: string; relationship_type: string; target_id?: string; target_type?: EntityCategory; }
interface EntityData {
  id: string;
  type: EntityCategory;
  primary_name: string;
  created_at?: string;
  updated_at?: string;
  attributes: Attribute[];
  relationships: Relationship[];
  attachments?: { original_filename: string; size_bytes: number; hash?: string; mime_type?: string }[];
}

export const EntityDashboard = ({ entity, onEntityUpdated }: { entity: EntityData; onEntityUpdated?: () => void }) => {
  const [error, setError] = useState<string | null>(null);
  const { setModalSourceEntityId, setModalEntityName, setModalOpen, setGraphViewOpen } = useCaseStore();
  
  const [isAddingAttribute, setIsAddingAttribute] = useState(false);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');
  const [isSubmittingAttr, setIsSubmittingAttr] = useState(false);

  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(entity.primary_name);
  
  const [editingAttrIdx, setEditingAttrIdx] = useState<number | null>(null);
  const [editAttrKey, setEditAttrKey] = useState('');
  const [editAttrValue, setEditAttrValue] = useState('');

  // Tag management
  const entityTags = entity.attributes.filter(a => a.key === '_tag').map(a => a.value);
  const handleAddTag = async (tag: string) => {
    if (entityTags.includes(tag)) return;
    try {
      await invoke('set_entity_tag', { entityId: entity.id, tag });
      entity.attributes.push({ key: '_tag', value: tag });
      onEntityUpdated?.();
    } catch (err: any) { setError(err.toString()); }
  };
  const handleRemoveTag = async (tag: string) => {
    try {
      await invoke('remove_entity_tag', { entityId: entity.id, tag });
      const idx = entity.attributes.findIndex(a => a.key === '_tag' && a.value === tag);
      if (idx > -1) entity.attributes.splice(idx, 1);
      onEntityUpdated?.();
    } catch (err: any) { setError(err.toString()); }
  };

  const handleUpdateName = async () => {
    if (!editNameValue.trim() || editNameValue === entity.primary_name) {
      setIsEditingName(false);
      return;
    }
    try {
      await invoke('update_entity', { id: entity.id, newName: editNameValue });
      entity.primary_name = editNameValue;
      setIsEditingName(false);
      // FIX: use activeTabs not tabs
      const store = useCaseStore.getState();
      const tab = store.activeTabs.find(t => t.id === store.activeTabId);
      if (tab) {
        tab.title = editNameValue;
        store.setActiveTab(store.activeTabId!);
      }
      onEntityUpdated?.();
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const handleUpdateAttribute = async (oldKey: string, oldValue: string, idx: number) => {
    if (!editAttrKey.trim() || !editAttrValue.trim()) return;
    try {
      await invoke('update_attribute', {
        entityId: entity.id,
        oldKey, oldValue, newKey: editAttrKey, newValue: editAttrValue
      });
      entity.attributes[idx] = { key: editAttrKey, value: editAttrValue };
      setEditingAttrIdx(null);
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const handleAddAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttrKey.trim() || !newAttrValue.trim()) return;
    
    setIsSubmittingAttr(true);
    try {
      await invoke('add_attribute', {
        payload: {
          entity_id: entity.id,
          key: newAttrKey,
          value: newAttrValue
        }
      });
      // Mock update to UI for instant feedback until parent re-fetches
      entity.attributes.push({ key: newAttrKey.trim(), value: newAttrValue.trim() });
      setIsAddingAttribute(false);
      setNewAttrKey('');
      setNewAttrValue('');
    } catch (err: any) {
      console.error(err);
      setError(err.toString());
    } finally {
      setIsSubmittingAttr(false);
    }
  };

  const handleAttachEvidence = async () => {
    try {
      setError(null);
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'OSINT Evidence',
          extensions: ['pdf', 'png', 'jpg', 'txt', 'csv', 'json', 'html']
        }]
      });

      if (selected && typeof selected === 'string') {
        await invoke('ingest_evidence', {
          entityId: entity.id,
          sourcePath: selected
        });
        console.log("Evidence attached successfully.");
      }
    } catch (err: any) {
      console.error("Failed to attach evidence:", err);
      setError(err.toString());
    }
  };

  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [customLogoUrl, setCustomLogoUrl] = useState('');

  const saveAvatar = async (url: string) => {
    try {
      await invoke('add_attribute', {
        payload: { entity_id: entity.id, key: 'logo_url', value: url }
      });
      entity.attributes.push({ key: 'logo_url', value: url });
      // Quick re-render hack for UI feedback
      setIsAddingAttribute(true);
      setTimeout(() => setIsAddingAttribute(false), 10);
      setIsIconPickerOpen(false);
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const handleSetAvatar = () => {
    setIsIconPickerOpen(true);
  };

  const handleSelectIcon = (key: string) => {
    const svg = SVG_ASSETS[key];
    if (svg) {
      const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      saveAvatar(dataUri);
    }
  };

  const handleDeleteEntity = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this entity and all its links/attributes?")) return;
    try {
      await invoke('delete_entity', { id: entity.id });
      // FIX: use closeTab, not removeTab
      const store = useCaseStore.getState();
      store.closeTab(store.activeTabId!);
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const handleDeleteAttribute = async (key: string, value: string) => {
    if (!window.confirm("Delete this attribute?")) return;
    try {
      await invoke('delete_attribute', { entityId: entity.id, key, value });
      // Hacky UI refresh
      const idx = entity.attributes.findIndex(a => a.key === key && a.value === value);
      if (idx > -1) entity.attributes.splice(idx, 1);
      setIsAddingAttribute(true);
      setTimeout(() => setIsAddingAttribute(false), 10);
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const handleDeleteLink = async (targetId: string, type: string) => {
    if (!window.confirm("Delete this relationship link?")) return;
    try {
      await invoke('delete_link', { sourceId: entity.id, targetId: targetId, relationshipType: type });
      await invoke('delete_link', { sourceId: targetId, targetId: entity.id, relationshipType: type });
      
      const idx = entity.relationships.findIndex(r => r.target_id === targetId && r.relationship_type === type);
      if (idx > -1) entity.relationships.splice(idx, 1);
      setIsAddingAttribute(true);
      setTimeout(() => setIsAddingAttribute(false), 10);
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const logoAttr = entity.attributes.find(a => a.key === 'logo_url');

  return (
    <div className="h-full bg-slate-950 text-slate-300 p-8 font-sans relative">
      {/* ICON PICKER MODAL */}
      {isIconPickerOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Select Entity Avatar
              </h2>
              <button onClick={() => setIsIconPickerOpen(false)} className="text-slate-500 hover:text-slate-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] custom-scrollbar bg-slate-900/50">
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-500 mb-3 tracking-widest uppercase">Custom Image URL</h3>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="https://example.com/image.png" 
                    value={customLogoUrl}
                    onChange={(e) => setCustomLogoUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                  <button 
                    onClick={() => customLogoUrl && saveAvatar(customLogoUrl)}
                    className="bg-emerald-900/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-800 px-4 py-2 rounded text-sm font-bold transition"
                  >
                    Apply URL
                  </button>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-500 mb-3 tracking-widest uppercase">Or Choose Built-in Icon</h3>
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
                  {Object.keys(SVG_ASSETS).map((key) => (
                    <button
                      key={key}
                      onClick={() => handleSelectIcon(key)}
                      title={key}
                      className="aspect-square bg-slate-800 border border-slate-700 rounded-lg hover:border-emerald-500 hover:bg-slate-700 flex items-center justify-center p-2 transition group overflow-hidden"
                    >
                      <div 
                        className="w-full h-full text-slate-400 group-hover:text-emerald-400 transition flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
                        dangerouslySetInnerHTML={{ __html: SVG_ASSETS[key] }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4 text-sm font-mono">
          Error: {error}
        </div>
      )}
      
      {/* Header Section */}
      <header className="border-b border-slate-800 pb-6 mb-8 flex justify-between items-start">
        <div className="flex items-center gap-6">
          {/* Custom Avatar Bubble */}
          <button 
            onClick={handleSetAvatar}
            className="w-20 h-20 rounded-full border-2 border-dashed border-slate-700 bg-slate-900 hover:border-emerald-500 hover:bg-slate-800 flex items-center justify-center overflow-hidden group transition relative"
            title="Set Custom Avatar / Logo"
          >
            {logoAttr ? (
              <>
                <img src={logoAttr.value} alt="Avatar" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </div>
              </>
            ) : (
              <div 
                className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 transition flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" 
                dangerouslySetInnerHTML={{ 
                  __html: SVG_ASSETS[getLogoKey({ name: entity.primary_name, category: entity.type.toLowerCase() })] || SVG_ASSETS.default 
                }} 
              />
            )}
          </button>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-bold">
                {entity.type}
              </span>
              {/* Classification Tags */}
              {entityTags.map(tag => {
                const cfg = CONFIDENCE_TAGS.find(t => t.label === tag);
                const col = cfg?.color || 'slate';
                return (
                  <span key={tag} className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded font-bold border flex items-center gap-1 bg-${col}-950/50 text-${col}-400 border-${col}-800`}>
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
                  </span>
                );
              })}
              {/* Add Tag Dropdown */}
              <select
                onChange={(e) => { if (e.target.value) handleAddTag(e.target.value); e.target.value = ''; }}
                defaultValue=""
                className="text-[10px] bg-slate-900 border border-slate-700 text-slate-500 rounded px-1 py-0.5 focus:outline-none focus:border-emerald-500 cursor-pointer hover:border-slate-500 transition"
              >
                <option value="">+ Tag</option>
                {CONFIDENCE_TAGS.filter(t => !entityTags.includes(t.label)).map(t => (
                  <option key={t.label} value={t.label}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span
                className="text-[10px] font-mono text-slate-600 cursor-pointer hover:text-slate-400 transition"
                title="Click to copy UUID"
                onClick={() => navigator.clipboard.writeText(entity.id)}
              >
                UUID: {entity.id.substring(0, 8)}…
              </span>
              {entity.created_at && (
                <span className="text-[10px] font-mono text-slate-600">
                  Added: {new Date(entity.created_at).toLocaleDateString()}
                </span>
              )}
              {entity.updated_at && entity.updated_at !== entity.created_at && (
                <span className="text-[10px] font-mono text-slate-600">
                  Updated: {new Date(entity.updated_at).toLocaleDateString()}
                </span>
              )}
            </div>
            {isEditingName ? (
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="text" 
                  value={editNameValue} 
                  onChange={e => setEditNameValue(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-3xl font-bold text-slate-100 rounded px-2 py-1 focus:outline-none focus:border-emerald-500 tracking-tight w-full max-w-sm"
                  autoFocus
                />
                <button onClick={handleUpdateName} className="text-emerald-500 hover:text-emerald-400 p-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </button>
                <button onClick={() => { setIsEditingName(false); setEditNameValue(entity.primary_name); }} className="text-slate-500 hover:text-slate-400 p-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 mt-2 group/name">
                <h1 className="text-4xl font-bold text-slate-100 tracking-tight">{entity.primary_name}</h1>
                <button 
                  onClick={() => setIsEditingName(true)}
                  className="opacity-0 group-hover/name:opacity-100 text-slate-500 hover:text-emerald-400 transition cursor-pointer"
                  title="Edit Entity Name"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setIsAddingAttribute(true)}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-4 py-2 rounded text-sm font-bold border border-slate-700 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Add Attribute
          </button>
          <button 
            onClick={handleAttachEvidence}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-4 py-2 rounded text-sm font-bold border border-slate-700 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
            Attach Evidence
          </button>
          <button 
            onClick={() => setGraphViewOpen(true)}
            className="bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 px-4 py-2 rounded text-sm font-bold border border-emerald-800 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            Open in Graph
          </button>
          <button 
            onClick={handleDeleteEntity}
            title="Permanently Delete Entity"
            className="bg-red-900/20 hover:bg-red-900/60 text-red-400 px-4 py-2 rounded text-sm font-bold border border-red-800 transition flex items-center gap-2 ml-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      </header>

      {/* Three-Column Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Column 1: Known Attributes (EAV Table) */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
            Known Attributes
          </h2>
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden font-mono text-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-500 text-xs">
                <tr>
                  <th className="px-4 py-2 font-normal">Key</th>
                  <th className="px-4 py-2 font-normal">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {entity.attributes.map((attr, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/50 transition group">
                    {editingAttrIdx === idx ? (
                      <td colSpan={2} className="px-4 py-2 bg-slate-900">
                        <div className="flex gap-2 items-center">
                          <input 
                            value={editAttrKey}
                            onChange={(e) => setEditAttrKey(e.target.value)}
                            className="bg-slate-950 border border-slate-700 text-slate-300 px-2 py-1 rounded text-sm w-1/3 focus:outline-none focus:border-emerald-500"
                          />
                          <input 
                            value={editAttrValue}
                            onChange={(e) => setEditAttrValue(e.target.value)}
                            className="bg-slate-950 border border-slate-700 text-slate-300 px-2 py-1 rounded text-sm flex-1 focus:outline-none focus:border-emerald-500"
                          />
                          <button onClick={() => handleUpdateAttribute(attr.key, attr.value, idx)} className="text-emerald-500 hover:text-emerald-400 p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                          </button>
                          <button onClick={() => setEditingAttrIdx(null)} className="text-slate-500 hover:text-slate-400 p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                          </button>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap align-top">
                          <div className="flex items-center gap-2 pt-0.5">
                            <button 
                              onClick={() => handleDeleteAttribute(attr.key, attr.value)}
                              className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition"
                              title="Delete Attribute"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                            <button 
                              onClick={() => { setEditingAttrIdx(idx); setEditAttrKey(attr.key); setEditAttrValue(attr.value); }}
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-emerald-400 transition ml-1"
                              title="Edit Attribute"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <span className="ml-1">{attr.key}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-200 break-all group-hover:bg-slate-800 transition">{attr.value}</td>
                      </>
                    )}
                  </tr>
                ))}
                {entity.attributes.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-slate-600 italic">No attributes recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="p-2 border-t border-slate-800">
              {isAddingAttribute ? (
                <form onSubmit={handleAddAttribute} className="flex flex-col gap-2 p-2 bg-slate-900 rounded border border-emerald-900/50">
                  <input 
                    type="text" 
                    placeholder="Key (e.g., DOB, Address)" 
                    value={newAttrKey}
                    onChange={e => setNewAttrKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 text-xs rounded focus:outline-none focus:border-emerald-500"
                    autoFocus
                    required
                  />
                  <input 
                    type="text" 
                    placeholder="Value..." 
                    value={newAttrValue}
                    onChange={e => setNewAttrValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 text-xs rounded focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <div className="flex gap-2 justify-end mt-1">
                    <button 
                      type="button" 
                      onClick={() => setIsAddingAttribute(false)}
                      className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmittingAttr}
                      className="text-xs bg-emerald-900/80 hover:bg-emerald-800 text-emerald-400 px-3 py-1 rounded font-bold disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <button 
                  onClick={() => setIsAddingAttribute(true)}
                  className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition border border-dashed border-slate-700"
                >
                  + Add Custom Key/Value
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Relational Topology (Linked Entities) */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Relational Topology
            </h2>
            <button 
              onClick={() => {
                setModalSourceEntityId(entity.id);
                setModalEntityName('');
                setModalOpen(true);
              }}
              className="text-[10px] font-bold bg-emerald-950 hover:bg-emerald-900 text-emerald-400 px-2 py-1 rounded transition border border-emerald-800 tracking-wider uppercase"
            >
              + Add Link
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {entity.relationships.map((rel, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-lg p-3 hover:border-emerald-900/50 hover:bg-slate-800 transition cursor-pointer group">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-200 font-bold group-hover:text-emerald-400 transition">{rel.target_name}</span>
                  {rel.target_type && (
                    <span className="text-[10px] text-slate-500 uppercase">{rel.target_type}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900 px-2 py-1 rounded font-mono">
                    {rel.relationship_type}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); rel.target_id && handleDeleteLink(rel.target_id, rel.relationship_type); }}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition"
                    title="Delete Relationship"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              </div>
            ))}
            {entity.relationships.length === 0 && (
              <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-600 italic text-sm">
                No known verified connections.
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Attached Evidence & File Hashes */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Evidence & File Hashes
          </h2>
          <div className="flex flex-col gap-3">
            {entity.attachments && entity.attachments.length > 0 ? (
              entity.attachments.map((file, idx) => (
                <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center p-3 border-b border-slate-800/50">
                    <span className="text-slate-200 font-medium truncate text-sm flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                      {file.original_filename}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {(file.size_bytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 flex justify-between items-center text-[10px] font-mono text-slate-500">
                    <span className="truncate mr-2" title={file.hash || 'Hash pending...'}>
                      SHA-256: {file.hash || 'Pending...'}
                    </span>
                    <span className="uppercase text-amber-500 bg-amber-950/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                      {file.mime_type || 'RAW'}
                    </span>
                  </div>
                  <button 
                    onClick={async () => {
                      if (!file.hash) return;
                      try {
                        await invoke('open_evidence', { fileHash: file.hash, originalFilename: file.original_filename });
                      } catch (err: any) {
                        setError(err.toString());
                      }
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 text-xs font-bold transition flex justify-center items-center gap-2 cursor-pointer"
                  >
                    Open in Secure Viewer
                  </button>
                </div>
              ))
            ) : (
              <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-600 italic text-sm">
                No evidence blobs ingested.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
