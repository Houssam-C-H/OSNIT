import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCaseStore } from '../../store/useCaseStore';
import { EntityCategory } from '../../types/intelligence';
import { SVG_ASSETS } from '../NetworkGraph';

export const CreateEntityModal: React.FC = () => {
  const { isCreateModalOpen, modalEntityName, modalSourceEntityId, setModalOpen, addTab, setModalSourceEntityId } = useCaseStore();
  
  const [category, setCategory] = useState<EntityCategory>('person');
  const [name, setName] = useState(modalEntityName);
  const [relationship, setRelationship] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  
  // Dynamic custom attributes
  const [attributes, setAttributes] = useState<{key: string, value: string}[]>([{key: '', value: ''}]);

  // Link to existing target state
  const [linkTargetId, setLinkTargetId] = useState<string>('');
  const [existingTargets, setExistingTargets] = useState<any[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state if modal opens with a new name
  useEffect(() => {
    setName(modalEntityName);
    setRelationship(''); // Reset relationship on new open
    setLogoUrl('');
    setLinkTargetId('');
    setAttributes([{key: '', value: ''}]);
  }, [modalEntityName, isCreateModalOpen]);

  // Load existing targets for linking
  useEffect(() => {
    if (isCreateModalOpen && !modalSourceEntityId) {
      invoke('search_entities', { query: '' })
        .then((data: any) => {
          const targets = data.filter((e: any) => e.entity_type?.toLowerCase() !== 'note');
          setExistingTargets(targets);
        })
        .catch(console.error);
    }
  }, [isCreateModalOpen, modalSourceEntityId]);

  if (!isCreateModalOpen) return null;

  const handleClose = () => {
    setModalOpen(false);
    setModalSourceEntityId(null);
  };

  const updateAttribute = (index: number, field: 'key' | 'value', val: string) => {
    const newAttrs = [...attributes];
    newAttrs[index][field] = val;
    setAttributes(newAttrs);
  };

  const addAttributeRow = () => setAttributes([...attributes, {key: '', value: ''}]);
  
  const removeAttributeRow = (index: number) => {
    if (attributes.length === 1) {
      setAttributes([{key: '', value: ''}]);
      return;
    }
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newEntity = await invoke('create_entity', {
        payload: {
          entity_type: category,
          primary_name: name,
        }
      });
      const newId = (newEntity as any).id;
      
      // Save Logo Attribute
      if (logoUrl.trim()) {
        await invoke('add_attribute', {
          payload: { entity_id: newId, key: 'logo_url', value: logoUrl.trim() }
        });
      }

      // Save Custom Attributes
      for (const attr of attributes) {
        if (attr.key.trim() && attr.value.trim()) {
          await invoke('add_attribute', {
            payload: { entity_id: newId, key: attr.key.trim(), value: attr.value.trim() }
          });
        }
      }

      // Handle Linking
      const effectiveSourceId = modalSourceEntityId || linkTargetId;
      if (effectiveSourceId && relationship.trim()) {
        await invoke('link_entities', {
          sourceId: effectiveSourceId,
          targetId: newId,
          relationshipType: relationship.trim()
        });
      }
      
      handleClose();
      
      if (newId) {
        addTab({
          id: `entity-${newId}`,
          type: 'ENTITY',
          title: name,
          dataId: newId,
        });
      }
    } catch (err) {
      console.error("Failed to create entity", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm overflow-y-auto pt-10 pb-10">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-xl shadow-2xl p-6 my-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Create Intelligence Target
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 text-sm rounded focus:outline-none focus:border-emerald-500 transition"
                autoFocus required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entity Category</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value as EntityCategory)}
                className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 text-sm rounded focus:outline-none focus:border-emerald-500 transition capitalize"
              >
                <optgroup label="Identities">
                  <option value="person">👤 Person</option>
                  <option value="company">🏢 Company</option>
                  <option value="organization">🏛️ Organization</option>
                </optgroup>
                <optgroup label="Communications">
                  <option value="phone">📞 Phone Number</option>
                  <option value="email">✉️ Email Address</option>
                  <option value="social">🌐 Social Account</option>
                  <option value="forum_profile">🕵️ Forum Profile</option>
                </optgroup>
                <optgroup label="Cyber Infrastructure">
                  <option value="ip_address">💻 IP Address</option>
                  <option value="domain">🌍 Domain</option>
                  <option value="url">🔗 URL Endpoint</option>
                  <option value="mac_address">⚙️ MAC Address</option>
                  <option value="asn">📡 ASN (ISP)</option>
                  <option value="hash">🏷️ File Hash</option>
                </optgroup>
                <optgroup label="Financial">
                  <option value="crypto_wallet">₿ Crypto Wallet</option>
                  <option value="bank_account">🏦 Bank Account</option>
                  <option value="credit_card">💳 Credit Card</option>
                </optgroup>
                <optgroup label="Physical & Documents">
                  <option value="location">📍 Location</option>
                  <option value="vehicle">🚗 Vehicle</option>
                  <option value="passport">🛂 Passport</option>
                  <option value="national_id">🪪 National ID</option>
                </optgroup>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-800 pt-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avatar / Custom Logo URL (Optional)</label>
            <input 
              type="text" 
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="bg-slate-950 border border-slate-800 text-slate-400 px-3 py-2 text-sm rounded focus:outline-none focus:border-emerald-500 transition mb-2"
            />
            
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Or Choose Built-in Icon</label>
            <div className="grid grid-cols-8 gap-2 bg-slate-950 p-2 rounded border border-slate-800 h-32 overflow-y-auto custom-scrollbar">
              {Object.keys(SVG_ASSETS).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLogoUrl(`builtin://${key}`)}
                  title={key}
                  className={`aspect-square rounded-lg flex items-center justify-center p-1.5 transition group overflow-hidden border ${logoUrl === `builtin://${key}` ? 'border-emerald-500 bg-slate-800' : 'border-transparent hover:bg-slate-800'}`}
                >
                  <div 
                    className={`w-full h-full flex items-center justify-center transition [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full ${logoUrl === `builtin://${key}` ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                    dangerouslySetInnerHTML={{ __html: SVG_ASSETS[key] }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-800 pt-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Additional Attributes (Optional)</label>
              <button type="button" onClick={addAttributeRow} className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-wider bg-emerald-950/50 px-2 py-1 rounded transition">+ Add Field</button>
            </div>
            
            <div className="flex flex-col gap-2 mt-1">
              {attributes.map((attr, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    placeholder="Key (e.g., DOB, Address)"
                    value={attr.key}
                    onChange={(e) => updateAttribute(i, 'key', e.target.value)}
                    className="w-1/3 bg-slate-950 border border-slate-800 text-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-emerald-500 transition"
                  />
                  <input 
                    type="text" 
                    placeholder="Value..."
                    value={attr.value}
                    onChange={(e) => updateAttribute(i, 'value', e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 text-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-emerald-500 transition"
                  />
                  <button type="button" onClick={() => removeAttributeRow(i)} className="text-slate-600 hover:text-red-500 transition px-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 pt-4 bg-slate-900/50 rounded p-3 border border-slate-800/50">
            {!modalSourceEntityId && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Link to Existing Target (Optional)</label>
                <select 
                  value={linkTargetId}
                  onChange={(e) => setLinkTargetId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 text-sm rounded focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="">-- No Link --</option>
                  {existingTargets.map(t => (
                    <option key={t.id} value={t.id}>{t.primary_name} ({t.entity_type})</option>
                  ))}
                </select>
              </div>
            )}

            {(modalSourceEntityId || linkTargetId) && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Relationship Type
                </label>
                <input 
                  type="text" 
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder="e.g., OWNS, DIRECTOR OF, USES PHONE..."
                  className="bg-slate-950 border border-emerald-900/50 text-slate-200 px-3 py-2 text-sm rounded focus:outline-none focus:border-emerald-500 transition uppercase"
                  required={!!modalSourceEntityId || !!linkTargetId}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 text-sm bg-emerald-900/80 hover:bg-emerald-800 text-emerald-300 border border-emerald-700 rounded transition font-bold disabled:opacity-50">
              {isSubmitting ? 'Committing...' : 'Commit to Vault'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
