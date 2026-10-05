import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

export const BulkImporter: React.FC = () => {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [entityType, setEntityType] = useState('Person');
  const [nameColumn, setNameColumn] = useState('');
  const [attributeColumns, setAttributeColumns] = useState<string[]>([]);
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      });

      if (selected && typeof selected === 'string') {
        setFilePath(selected);
        setStatus('loading');
        setMessage('Reading CSV headers...');
        
        // Fetch only the first row to map headers
        const extractedHeaders = await invoke<string[]>('preview_csv_headers', { filePath: selected });
        setHeaders(extractedHeaders);
        setNameColumn(extractedHeaders[0] || ''); // Default to first col
        setAttributeColumns([]); // Reset mapped attributes
        setStatus('idle');
      }
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err.toString());
    }
  };

  const handleToggleAttribute = (header: string) => {
    if (header === nameColumn) return; // Cannot map primary name as a secondary attribute
    setAttributeColumns(prev => 
      prev.includes(header) ? prev.filter(h => h !== header) : [...prev, header]
    );
  };

  const handleRunImport = async () => {
    if (!filePath || !nameColumn) return;
    
    try {
      setStatus('loading');
      setMessage('Streaming CSV to local SQLite instance... Please wait.');
      
      const importedCount = await invoke<number>('run_bulk_import', {
        filePath,
        entityType,
        nameColumn,
        attributeColumns
      });

      setStatus('success');
      setMessage(`Operation Successful: Ingested ${importedCount.toLocaleString()} entities into encrypted storage.`);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err.toString());
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-[calc(100vh-100px)] bg-slate-950 text-slate-300 font-mono text-sm overflow-y-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-6 uppercase tracking-wider border-b border-slate-800 pb-4">
        Secure Data Ingestion
      </h1>

      {/* Step 1: File Selection */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-6 shadow-xl">
        <h2 className="text-emerald-400 font-bold mb-4">Step 1: Select CSV Payload</h2>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleSelectFile}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded border border-slate-600 transition cursor-pointer"
          >
            Browse Files...
          </button>
          <span className="text-slate-500 truncate">{filePath || 'No local file selected.'}</span>
        </div>
      </div>

      {/* Step 2: Mapping UI */}
      {headers.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-6 shadow-xl space-y-6">
          <h2 className="text-emerald-400 font-bold">Step 2: Map Data Columns to EAV Schema</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-slate-400 mb-2 font-semibold">Target Entity Type</label>
              <select 
                value={entityType} 
                onChange={e => setEntityType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="Person">Person</option>
                <option value="Org">Organization</option>
                <option value="IP">IP Address</option>
                <option value="Location">Location</option>
                <option value="Alias">Alias</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-2 font-semibold">Primary Name Column</label>
              <select 
                value={nameColumn} 
                onChange={e => {
                  setNameColumn(e.target.value);
                  setAttributeColumns(prev => prev.filter(h => h !== e.target.value));
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 outline-none focus:border-emerald-500 cursor-pointer"
              >
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-2 border-b border-slate-800 pb-2 font-semibold">
              Select Additional Columns to ingest as Attributes
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {headers.map(h => {
                if (h === nameColumn) return null;
                const isSelected = attributeColumns.includes(h);
                return (
                  <label 
                    key={h} 
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition ${
                      isSelected ? 'border-emerald-500 bg-emerald-900/20 text-emerald-300' : 'border-slate-700 hover:bg-slate-800 text-slate-400'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      className="hidden"
                      checked={isSelected}
                      onChange={() => handleToggleAttribute(h)}
                    />
                    <span className="truncate" title={h}>{h}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Execution */}
      {headers.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 shadow-xl">
          <h2 className="text-emerald-400 font-bold mb-4">Step 3: Execute Transaction</h2>
          
          <button 
            onClick={handleRunImport}
            disabled={status === 'loading'}
            className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded transition tracking-widest uppercase cursor-pointer"
          >
            {status === 'loading' ? 'Processing SQLite Transaction...' : 'Run Bulk Import'}
          </button>
        </div>
      )}

      {/* Status Notifications */}
      {status === 'loading' && (
        <div className="mt-6 p-4 rounded bg-blue-900/30 border border-blue-500 text-blue-300 text-center animate-pulse">
          {message}
        </div>
      )}
      {status === 'success' && (
        <div className="mt-6 p-4 rounded bg-emerald-900/30 border border-emerald-500 text-emerald-300 text-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          {message}
        </div>
      )}
      {status === 'error' && (
        <div className="mt-6 p-4 rounded bg-red-900/30 border border-red-500 text-red-300 text-center">
          {message}
        </div>
      )}
    </div>
  );
};
