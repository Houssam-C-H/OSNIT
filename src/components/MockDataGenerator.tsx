import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCaseStore } from '../store/useCaseStore';

export const MockDataGenerator: React.FC = () => {
  const [status, setStatus] = useState('Idle');
  const { currentWorkspace } = useCaseStore();

  const handleSimulate = async () => {
    if (!currentWorkspace) {
      setStatus('Error: No Active Case File');
      return;
    }
    
    setStatus('Injecting OP_PHANTOM_STRIKE Simulation...');
    
    try {
      // --- 1. Create Entities ---
      
      // People
      const viktor = await invoke<any>('create_entity', { payload: { entity_type: 'person', primary_name: 'Viktor Sokolov' } });
      const elena = await invoke<any>('create_entity', { payload: { entity_type: 'person', primary_name: 'Elena Rostova' } });
      const james = await invoke<any>('create_entity', { payload: { entity_type: 'person', primary_name: 'James Thorne' } });
      
      // Companies / Orgs
      const phantomCorp = await invoke<any>('create_entity', { payload: { entity_type: 'company', primary_name: 'Phantom Holdings Ltd' } });
      const horizonLogistics = await invoke<any>('create_entity', { payload: { entity_type: 'company', primary_name: 'Horizon Logistics' } });
      const darknetGroup = await invoke<any>('create_entity', { payload: { entity_type: 'organization', primary_name: 'DarkNet Forums Group' } });
      
      // Cyber Infrastructure
      const c2IP = await invoke<any>('create_entity', { payload: { entity_type: 'ip_address', primary_name: '185.15.22.1' } });
      const onionUrl = await invoke<any>('create_entity', { payload: { entity_type: 'url', primary_name: 'phantom-secure.onion' } });
      const scamDomain = await invoke<any>('create_entity', { payload: { entity_type: 'domain', primary_name: 'secure-horizon-auth.com' } });
      
      // Communications & Socials
      const viktorEmail = await invoke<any>('create_entity', { payload: { entity_type: 'email', primary_name: 'phantom@protonmail.com' } });
      const elenaTelegram = await invoke<any>('create_entity', { payload: { entity_type: 'social', primary_name: 'elena.r@telegram' } });
      const jamesLinkedIn = await invoke<any>('create_entity', { payload: { entity_type: 'social', primary_name: 'James Thorne (LinkedIn)' } });
      const jamesPhone = await invoke<any>('create_entity', { payload: { entity_type: 'phone', primary_name: '+44 7700 900123' } });
      const viktorPhone = await invoke<any>('create_entity', { payload: { entity_type: 'phone', primary_name: '+7 910 123 4567' } });
      const horizonTwitter = await invoke<any>('create_entity', { payload: { entity_type: 'social', primary_name: 'Horizon_Logistics (Twitter)' } });
      
      // Financial
      const ransomwareWallet = await invoke<any>('create_entity', { payload: { entity_type: 'crypto_wallet', primary_name: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy' } });
      const launderingWallet = await invoke<any>('create_entity', { payload: { entity_type: 'crypto_wallet', primary_name: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2' } });
      const offshoreBank = await invoke<any>('create_entity', { payload: { entity_type: 'bank_account', primary_name: 'Horizon Offshore Account' } });

      // --- 2. Link Entities ---
      
      // Viktor's Network
      await invoke('link_entities', { sourceId: viktor.id, targetId: viktorEmail.id, relationshipType: 'Uses Email' });
      await invoke('link_entities', { sourceId: viktor.id, targetId: viktorPhone.id, relationshipType: 'Uses Phone' });
      await invoke('link_entities', { sourceId: viktor.id, targetId: phantomCorp.id, relationshipType: 'Beneficial Owner' });
      await invoke('link_entities', { sourceId: viktor.id, targetId: ransomwareWallet.id, relationshipType: 'Controls Wallet' });
      
      // Elena's Network
      await invoke('link_entities', { sourceId: elena.id, targetId: viktor.id, relationshipType: 'Co-Conspirator' });
      await invoke('link_entities', { sourceId: elena.id, targetId: elenaTelegram.id, relationshipType: 'Uses Telegram' });
      await invoke('link_entities', { sourceId: elena.id, targetId: onionUrl.id, relationshipType: 'Server Admin' });
      await invoke('link_entities', { sourceId: elena.id, targetId: c2IP.id, relationshipType: 'Configures C2' });
      await invoke('link_entities', { sourceId: elena.id, targetId: darknetGroup.id, relationshipType: 'Moderator' });
      
      // James's Network (The Front)
      await invoke('link_entities', { sourceId: james.id, targetId: horizonLogistics.id, relationshipType: 'CEO (Proxy)' });
      await invoke('link_entities', { sourceId: james.id, targetId: jamesLinkedIn.id, relationshipType: 'Public Profile' });
      await invoke('link_entities', { sourceId: james.id, targetId: jamesPhone.id, relationshipType: 'Business Phone' });
      
      // Corporate Network
      await invoke('link_entities', { sourceId: horizonLogistics.id, targetId: phantomCorp.id, relationshipType: 'Subsidiary Of' });
      await invoke('link_entities', { sourceId: horizonLogistics.id, targetId: offshoreBank.id, relationshipType: 'Corporate Account' });
      await invoke('link_entities', { sourceId: horizonLogistics.id, targetId: horizonTwitter.id, relationshipType: 'Official PR' });
      
      // Cyber Network
      await invoke('link_entities', { sourceId: c2IP.id, targetId: scamDomain.id, relationshipType: 'Hosts' });
      await invoke('link_entities', { sourceId: scamDomain.id, targetId: viktorEmail.id, relationshipType: 'Registered By' });
      
      // Financial Flow
      await invoke('link_entities', { sourceId: ransomwareWallet.id, targetId: launderingWallet.id, relationshipType: 'Launders To' });
      await invoke('link_entities', { sourceId: launderingWallet.id, targetId: offshoreBank.id, relationshipType: 'Liquidates To' });
      
      // Complex internal links (creating curvature)
      await invoke('link_entities', { sourceId: viktor.id, targetId: elena.id, relationshipType: 'Funds' });
      await invoke('link_entities', { sourceId: phantomCorp.id, targetId: ransomwareWallet.id, relationshipType: 'Treasury' });

      setStatus('OP_PHANTOM_STRIKE Successfully Injected! (Check the Graph)');
      
      // Clear status message after 5 seconds
      setTimeout(() => setStatus('Idle'), 5000);
    } catch (err: any) {
      console.error(err);
      setStatus('Error: ' + err.toString());
    }
  };

  return (
    <div className="fixed bottom-10 right-10 flex flex-col items-end gap-2 z-[9999]">
      {status !== 'Idle' && (
        <div className="bg-emerald-900 text-emerald-100 p-4 rounded shadow-2xl font-mono text-xs border border-emerald-500 animate-pulse">
          {status}
        </div>
      )}
      <button 
        onClick={handleSimulate}
        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold font-mono text-sm shadow-2xl transition flex items-center gap-2 cursor-pointer border-2 border-white animate-bounce"
        title="Injects a massive 18-node simulated investigation into the active case file"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        SIMULATE MOCK INVESTIGATION
      </button>
    </div>
  );
};
