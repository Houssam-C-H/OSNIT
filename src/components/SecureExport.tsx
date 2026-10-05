import React, { useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

export const SecureExport: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'archiving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleExport = async () => {
    // Strict Validation
    if (password.length < 12) {
      setStatus('error');
      setMessage('Password must be at least 12 characters long to ensure cryptographic integrity for AES-256.');
      return;
    }
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    try {
      // 1. Trigger the Tauri native Save Dialog
      const savePath = await save({
        filters: [{ name: 'Secure OSINT Archive', extensions: ['zip'] }],
        defaultPath: 'intelligence_handoff.zip'
      });

      if (!savePath) {
        return; // User canceled the dialog
      }

      setStatus('archiving');
      setMessage('Packaging database snapshot and encrypting evidence files... Please wait.');

      // 2. Invoke the Rust heavy-lifting export engine
      const responseMessage = await invoke<string>('export_secure_archive', {
        targetPath: savePath,
        archivePassword: password
      });

      setStatus('success');
      setMessage(responseMessage);
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error("Export Failed:", err);
      setStatus('error');
      setMessage(err.toString());
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-[calc(100vh-100px)] bg-slate-950 text-slate-300 font-mono text-sm overflow-y-auto">
      <h1 className="text-2xl font-bold text-amber-500 mb-6 uppercase tracking-wider border-b border-amber-900/50 pb-4 flex items-center gap-3">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Secure Case Handoff
      </h1>

      <div className="bg-slate-900 border border-amber-900/50 rounded-lg p-6 shadow-[0_0_20px_rgba(245,158,11,0.05)] mb-6">
        <h2 className="text-lg text-amber-400 font-bold mb-3">Export Protocol Warning</h2>
        <p className="text-slate-400 leading-relaxed mb-6 border-l-2 border-amber-500 pl-4">
          You are about to export sensitive intelligence outside of the encrypted local vault. 
          The case database and all hashed evidence files will be aggregated and locked into a single 
          <span className="text-amber-300 font-semibold mx-1">AES-256 Encrypted ZIP Archive</span>. 
          You must provide a strong password to securely generate the encryption keys.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-slate-400 mb-2 font-semibold">Archive Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 outline-none focus:border-amber-500 transition"
              placeholder="Min 12 characters..."
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-2 font-semibold">Confirm Password</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 outline-none focus:border-amber-500 transition"
              placeholder="Re-type password..."
            />
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={status === 'archiving'}
          className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-wait text-white font-bold py-4 px-6 rounded transition tracking-widest uppercase flex justify-center items-center gap-3 shadow-lg cursor-pointer"
        >
          {status === 'archiving' ? (
            <>
              <svg className="animate-spin h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating AES-256 Archive...
            </>
          ) : (
            'Export Secure Case Archive'
          )}
        </button>
      </div>

      {/* Status Notifications */}
      {status === 'success' && (
        <div className="bg-emerald-900/20 border border-emerald-500/50 rounded-lg p-6 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-fade-in text-emerald-300">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Export Complete
          </h3>
          <p className="text-sm">{message}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-red-400">
          <h3 className="font-bold mb-2">Export Terminated</h3>
          <p className="text-sm break-words">{message}</p>
        </div>
      )}
    </div>
  );
};
