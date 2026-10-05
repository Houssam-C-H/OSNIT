import React, { useRef, useMemo, useEffect, useState } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { invoke } from '@tauri-apps/api/core';
import { useCaseStore } from '../store/useCaseStore';
import { GraphNode, GraphLink } from '../types/intelligence';

// ==========================================
// 1. IMAGE CACHE & SVG PRELOADING
// ==========================================
// ALL SVGs MUST have explicit width and height attributes to render on Canvas without naturalHeight=0 bugs.
export const SVG_ASSETS: Record<string, string> = {
  person: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  company: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>',
  phone: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>',
  email: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
  ip: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
  crypto: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M17 11c.3 0 .5-.2.5-.5s-.2-.5-.5-.5h-2V8h2c.3 0 .5-.2.5-.5S17.3 7 17 7h-2V5c0-.6-.4-1-1-1s-1 .4-1 1v2h-1V5c0-.6-.4-1-1-1s-1 .4-1 1v2H7c-.6 0-1 .4-1 1s.4 1 1 1h1v8H7c-.6 0-1 .4-1 1s.4 1 1 1h3v2c0 .6.4 1 1 1s1-.4 1-1v-2h1v2c0 .6.4 1 1 1s1-.4 1-1v-2h2c2.2 0 4-1.8 4-4 0-1.5-.8-2.7-2-3.4 1.1-.6 1.8-1.7 1.8-3.1 0-2.2-1.8-4-4-4zm-5 4v-4h2c1.1 0 2 .9 2 2s-.9 2-2 2h-2zm3 6h-3v-4h3c1.1 0 2 .9 2 2s-.9 2-2 2z"/></svg>',
  
  // Specific Brands
  twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  telegram: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>',
  linkedin: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.16-3.66c-1.16 0-1.69.71-1.96 1.2v-1.03h-3v8.79h3v-4.93c0-.77.13-1.53 1-1.53.85 0 .86.89.86 1.58v4.88h3.04zM6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>',
  protonmail: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#8b5cf6"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2zm-5 7v-1c0-.82-.68-1.5-1.5-1.5S12 13.18 12 14v1c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1h3c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1zm-1 0h-1v-1c0-.28.22-.5.5-.5s.5.22.5.5v1z"/></svg>',
  facebook: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95 0-5.52-4.48-10-10-10z"/></svg>',
  instagram: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 0 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
  tiktok: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93v7.2c0 1.53-.33 3.11-1.08 4.41a8.62 8.62 0 0 1-3.32 3.19c-1.48.71-3.23 1.05-4.83.8-1.52-.25-2.93-.97-4.04-2.07-1.3-1.3-2.1-3.07-2.31-4.9-.17-1.53.07-3.13.78-4.52.8-1.53 2.15-2.73 3.67-3.32 1.34-.52 2.87-.66 4.25-.41v4.06c-.53-.13-1.1-.11-1.61.07a4.01 4.01 0 0 0-2.31 2.37c-.36.95-.31 2.05.15 2.95.4.79 1.1 1.43 1.94 1.7.9.29 1.93.22 2.76-.23a4.02 4.02 0 0 0 1.83-2.82c.18-.87.16-1.78.16-2.67V.02h3.45z"/></svg>',
  youtube: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M21.582 6.186a2.6 2.6 0 0 0-1.832-1.84C18.135 3.9 12 3.9 12 3.9s-6.135 0-7.75.446a2.6 2.6 0 0 0-1.832 1.84C1.97 7.821 1.97 12 1.97 12s0 4.18.448 5.814a2.6 2.6 0 0 0 1.832 1.84C5.865 20.1 12 20.1 12 20.1s6.135 0 7.75-.446a2.6 2.6 0 0 0 1.832-1.84C22.03 16.18 22.03 12 22.03 12s0-4.179-.448-5.814zM9.99 15.45V8.55L15.93 12l-5.94 3.45z"/></svg>',
  
  default: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
};

const ImageCache = new Map<string, HTMLImageElement>();

Object.entries(SVG_ASSETS).forEach(([key, svg]) => {
  const img = new Image();
  // Using encodeURIComponent safely wraps the raw SVG for data URIs
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  ImageCache.set(key, img);
});

// Helper to determine intelligent icon based on entity data
export function getLogoKey(node: any): string {
  const name = (node.name || '').toLowerCase();
  
  // High Priority Brand Matching
  if (name.includes('twitter') || name.includes(' x ')) return 'twitter';
  if (name.includes('telegram') || name.includes('t.me')) return 'telegram';
  if (name.includes('linkedin')) return 'linkedin';
  if (name.includes('protonmail')) return 'protonmail';
  if (name.includes('facebook')) return 'facebook';
  if (name.includes('instagram') || name.includes('ig ')) return 'instagram';
  if (name.includes('tiktok')) return 'tiktok';
  if (name.includes('youtube')) return 'youtube';
  
  // Category Fallbacks
  if (node.category === 'person') return 'person';
  if (node.category === 'company' || node.category === 'org' || node.category === 'organization') return 'company';
  if (node.category === 'phone') return 'phone';
  if (node.category === 'email') return 'email';
  if (node.category === 'crypto_wallet') return 'crypto';
  if (node.category === 'ip' || node.category === 'ip_address' || node.category === 'domain') return 'ip';

  return 'default';
}

function getBadge(node: any): string | null {
  const n = (node.name || '').toLowerCase();
  if (n.startsWith('+44')) return '🇬🇧';
  if (n.startsWith('+1')) return '🇺🇸';
  if (n.startsWith('+7')) return '🇷🇺';
  if (node.category === 'person') return '✓'; // Verified checkmark
  if (node.category === 'crypto_wallet') return '🔒';
  return null;
}

const CATEGORY_STYLES: Record<string, { fill: string; stroke: string; }> = {
  person: { fill: '#0f3d4c', stroke: '#00a3c4' },
  company: { fill: '#143055', stroke: '#2b7fff' },
  org: { fill: '#1e3a8a', stroke: '#60a5fa' },
  organization: { fill: '#1e3a8a', stroke: '#60a5fa' },
  phone: { fill: '#14532d', stroke: '#22c55e' },
  email: { fill: '#78350f', stroke: '#f59e0b' },
  social: { fill: '#1e293b', stroke: '#38bdf8' },
  forum_profile: { fill: '#334155', stroke: '#cbd5e1' },
  ip: { fill: '#450a0a', stroke: '#ef4444' },
  ip_address: { fill: '#450a0a', stroke: '#ef4444' },
  domain: { fill: '#172554', stroke: '#3b82f6' },
  url: { fill: '#172554', stroke: '#93c5fd' },
  mac_address: { fill: '#3f2c00', stroke: '#eab308' },
  asn: { fill: '#28153b', stroke: '#c084fc' },
  hash: { fill: '#3f3f46', stroke: '#a1a1aa' },
  crypto_wallet: { fill: '#422006', stroke: '#f59e0b' },
  bank_account: { fill: '#064e3b', stroke: '#34d399' },
  credit_card: { fill: '#0f172a', stroke: '#94a3b8' },
  location: { fill: '#4a154b', stroke: '#a855f7' },
  vehicle: { fill: '#3f3f46', stroke: '#71717a' },
  passport: { fill: '#1e1b4b', stroke: '#818cf8' },
  national_id: { fill: '#4c1d95', stroke: '#c4b5fd' },
  alias: { fill: '#78350f', stroke: '#f59e0b' }
};

interface BackendGraphNode {
  id: string;
  primary_name: string;
  entity_type: string;
}

interface BackendGraphLink {
  source: string;
  target: string;
  relationship_type: string;
}

interface BackendGraphPayload {
  nodes: BackendGraphNode[];
  links: BackendGraphLink[];
}

export const NetworkGraph: React.FC = () => {
  const fgRef = useRef<ForceGraphMethods>();
  const { addTab, setGraphViewOpen, activeTabId } = useCaseStore();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedInspectorNode, setSelectedInspectorNode] = useState<GraphNode | null>(null);
  
  // Graph Filtering State
  const [isGlobalView, setIsGlobalView] = useState(false);
  const [contextEntityId, setContextEntityId] = useState<string | null>(null);

  // Force a re-render once images load if they didn't load instantly
  const [, setTrigger] = useState(0);
  useEffect(() => {
    let allLoaded = true;
    ImageCache.forEach(img => {
      if (!img.complete) {
        allLoaded = false;
        img.onload = () => setTrigger(t => t + 1);
      }
    });
    if (!allLoaded) {
      setTimeout(() => setTrigger(t => t + 1), 500); // Safety net
    }
  }, []);

  useEffect(() => {
    // Determine context on mount
    let focusId = null;
    if (activeTabId && activeTabId.startsWith('entity-')) {
      focusId = activeTabId.replace('entity-', '');
      setContextEntityId(focusId);
    }

    invoke<BackendGraphPayload>('get_network_graph')
      .then((data) => {
        let finalNodes = data.nodes;
        let finalLinks = data.links;

        // Execute BFS filtering if not in global mode and we have a focus
        if (!isGlobalView && focusId) {
          const connected = new Set<string>();
          const queue = [focusId];
          connected.add(focusId);
          
          const adj = new Map<string, string[]>();
          for (const l of data.links) {
             if (!adj.has(l.source)) adj.set(l.source, []);
             if (!adj.has(l.target)) adj.set(l.target, []);
             adj.get(l.source)!.push(l.target);
             adj.get(l.target)!.push(l.source);
          }
          
          let head = 0;
          while(head < queue.length) {
             const curr = queue[head++];
             const neighbors = adj.get(curr) || [];
             for (const n of neighbors) {
                if (!connected.has(n)) {
                   connected.add(n);
                   queue.push(n);
                }
             }
          }
          
          finalNodes = data.nodes.filter(n => connected.has(n.id));
          finalLinks = data.links.filter(l => connected.has(l.source) && connected.has(l.target));
        }

        const mappedNodes: GraphNode[] = finalNodes.map(n => ({
          id: n.id,
          name: n.primary_name,
          category: (n.entity_type.toLowerCase() as any),
        }));
        
        const mappedLinks: GraphLink[] = finalLinks.map(l => ({
          source: l.source,
          target: l.target,
          label: l.relationship_type
        }));
        
        setNodes(mappedNodes);
        setLinks(mappedLinks);
      })
      .catch((err) => console.error("Failed to load network graph:", err));
  }, [isGlobalView, activeTabId]);

  // Apply d3 physics tuning to spread nodes apart
  useEffect(() => {
    if (fgRef.current) {
      // Increase repulsion significantly to prevent clustering
      const chargeForce = fgRef.current.d3Force('charge');
      if (chargeForce) {
        chargeForce.strength(-1000);
        chargeForce.distanceMax(800);
      }
      
      // Increase link distance so connected nodes aren't on top of each other
      const linkForce = fgRef.current.d3Force('link');
      if (linkForce) {
        linkForce.distance(150);
      }
      
      // Re-heat simulation to apply the new forces
      fgRef.current.d3ReheatSimulation();
    }
  }, [nodes.length, links.length]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleSelectNode = (node: GraphNode) => {
    setSelectedInspectorNode(node);
  };

  const handleOpenDossier = () => {
    if (selectedInspectorNode) {
      addTab({
        id: `entity-${selectedInspectorNode.id}`,
        type: 'ENTITY',
        title: selectedInspectorNode.name,
        dataId: selectedInspectorNode.id,
      });
      setGraphViewOpen(false);
    }
  };

  const curvedLinks = useMemo(() => {
    const linkMap = new Map<string, number>();
    return links.map(link => {
      const s = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source;
      const t = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target;
      const key = s < t ? `${s}-${t}` : `${t}-${s}`;
      const count = linkMap.get(key) || 0;
      linkMap.set(key, count + 1);
      return {
        ...link,
        curvature: count > 0 ? (count % 2 === 0 ? count * 0.15 : -count * 0.15) : 0
      };
    });
  }, [links]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0a0f1d] overflow-hidden">
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <button 
          onClick={() => setGraphViewOpen(false)}
          className="bg-slate-900 border border-slate-700 text-slate-300 px-4 py-2 rounded hover:bg-slate-800 transition font-mono text-sm shadow-xl cursor-pointer"
        >
          ← Return to Workspace
        </button>
        {contextEntityId && (
          <button 
            onClick={() => setIsGlobalView(!isGlobalView)}
            className="bg-slate-900 border border-emerald-900/50 text-emerald-400 px-4 py-2 rounded hover:bg-slate-800 transition font-mono text-sm shadow-xl cursor-pointer flex items-center gap-2"
          >
            <span className={`w-2 h-2 rounded-full ${isGlobalView ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
            {isGlobalView ? 'Viewing Global Network' : 'Viewing Local File Context'}
          </button>
        )}
      </div>

      <div className="absolute top-20 left-4 z-20 flex flex-col gap-2 bg-slate-900/90 border border-slate-800 p-2 rounded-xl shadow-2xl backdrop-blur">
        <button 
          onClick={() => fgRef.current?.zoomToFit(400)} 
          title="Zoom to Fit"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-sm cursor-pointer"
        >
          🔍
        </button>
        <button 
          onClick={() => fgRef.current?.d3ReheatSimulation()} 
          title="Re-layout"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-sm cursor-pointer"
        >
          🔄
        </button>
      </div>

      {selectedInspectorNode && (
        <div className="absolute top-0 right-0 h-full w-80 bg-slate-950/95 backdrop-blur-md border-l border-slate-800 shadow-2xl z-30 flex flex-col transform transition-transform animate-in slide-in-from-right">
          <div className="p-4 border-b border-slate-800 flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-bold w-fit">
                {selectedInspectorNode.category}
              </span>
              <h2 className="text-xl font-bold text-slate-100 mt-2">{selectedInspectorNode.name}</h2>
              <p className="text-xs font-mono text-slate-500 mt-1 truncate" title={selectedInspectorNode.id}>UUID: {selectedInspectorNode.id}</p>
            </div>
            <button onClick={() => setSelectedInspectorNode(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            <p className="text-slate-400 text-sm mb-4">Detailed attributes and verified intelligence relationships are encrypted in the Dossier Vault.</p>
          </div>
          <div className="p-4 border-t border-slate-800 bg-slate-900/50">
            <button 
              onClick={handleOpenDossier}
              className="w-full bg-emerald-900/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-800 py-2 rounded font-bold transition flex justify-center items-center gap-2 cursor-pointer"
            >
              Open Full Dossier
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>
        </div>
      )}

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={{ nodes, links: curvedLinks }}
        nodeRelSize={14}
        linkCurvature="curvature"
        linkColor={() => '#94a3b8'} 
        linkWidth={2}
        linkDirectionalArrowLength={12}
        linkDirectionalArrowRelPos={0.8}
        linkDirectionalArrowColor={() => '#10b981'} // Emerald green for high visibility
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link: any, ctx, globalScale) => {
          // NO globalScale restrictions so labels are ALWAYS drawn.
          const start = link.source;
          const end = link.target;
          
          // Safety check for force-graph object hydration
          if (!start || !end || start.x === undefined || end.x === undefined) return;

          // Calculate midpoint
          const midX = start.x + (end.x - start.x) / 2;
          const midY = start.y + (end.y - start.y) / 2;

          // Calculate angle for text rotation
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          let angle = Math.atan2(dy, dx);
          
          // Flip angle if it means the text would be rendered upside down (left-to-right reading)
          if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
            angle += Math.PI;
          }

          const fontSize = Math.max(10 / globalScale, 3); // Ensure text scales but has a minimum legibility
          ctx.font = `600 ${fontSize}px Inter, sans-serif`;
          const textWidth = ctx.measureText(link.label || 'LINKED').width;
          const paddingX = 6 / globalScale;
          const paddingY = 4 / globalScale;

          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(angle);

          // Draw pill background (centered at 0,0)
          ctx.beginPath();
          if ((ctx as any).roundRect) {
            (ctx as any).roundRect(
              -textWidth / 2 - paddingX,
              -fontSize / 2 - paddingY,
              textWidth + paddingX * 2,
              fontSize + paddingY * 2,
              4 / globalScale
            );
          } else {
            ctx.rect(
              -textWidth / 2 - paddingX,
              -fontSize / 2 - paddingY,
              textWidth + paddingX * 2,
              fontSize + paddingY * 2
            );
          }
          
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Slate-800 with opacity
          ctx.fill();
          ctx.strokeStyle = '#475569'; // Slate-600 border
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();

          // Draw label text
          ctx.fillStyle = '#38bdf8'; // Bright Sky Blue for extremely clear edge readability
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((link.label || 'LINKED').toUpperCase(), 0, 0);

          ctx.restore();
        }}
        
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const config = CATEGORY_STYLES[node.category] || CATEGORY_STYLES.person;
          const radius = 16;
          const isSelected = selectedInspectorNode?.id === node.id;

          // 1. The Base Ring
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = config.fill;
          ctx.fill();
          
          ctx.lineWidth = isSelected ? 4 : 2;
          ctx.strokeStyle = isSelected ? '#10b981' : config.stroke; // Emerald glow if selected
          ctx.stroke();

          // 2. The Inner Clipping Mask
          ctx.save();
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius - 1, 0, 2 * Math.PI, false);
          ctx.clip();

          // 3. Drawing the Actual Logo Image
          let img: HTMLImageElement | undefined;
          
          if (node.custom_logo_url) {
            img = ImageCache.get(node.custom_logo_url);
            if (!img) {
              img = new Image();
              img.src = node.custom_logo_url;
              // Re-render graph once loaded
              img.onload = () => setTrigger(t => t + 1);
              ImageCache.set(node.custom_logo_url, img);
            }
          } else {
            const logoKey = getLogoKey(node);
            img = ImageCache.get(logoKey);
          }
          
          if (img && img.complete) {
            const imgSize = radius * 1.4; // Scale image nicely inside the circle
            ctx.drawImage(img, node.x - imgSize / 2, node.y - imgSize / 2, imgSize, imgSize);
          } else {
            ctx.fillStyle = config.fill;
            ctx.fill();
          }

          // 4. Restore Context
          ctx.restore();

          // 5. Badge Indicator (Country Flags / Status)
          const badge = getBadge(node);
          if (badge) {
            const badgeRadius = 6;
            const badgeX = node.x + radius * 0.7;
            const badgeY = node.y + radius * 0.7;
            
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI, false);
            ctx.fillStyle = '#1e293b'; // Background for badge
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#0f172a';
            ctx.stroke();

            ctx.font = `${badgeRadius * 1.4}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#10b981';
            ctx.fillText(badge, badgeX, badgeY + 0.5); // +0.5 for visual alignment
          }

          // 6. The Text Label (Always drawn now, regardless of zoom)
          const fontSize = Math.max(12 / globalScale, 6);
          ctx.font = `600 ${fontSize}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 4;
          ctx.fillStyle = isSelected ? '#34d399' : '#f8fafc';
          ctx.fillText(node.name, node.x, node.y + radius + 4);
          
          ctx.shadowBlur = 0; // Reset
        }}
        onNodeClick={(node: any) => handleSelectNode(node)}
        onNodeRightClick={(node: any) => {
          addTab({
            id: `entity-${node.id}`,
            type: 'ENTITY',
            title: node.name,
            dataId: node.id,
          });
          setGraphViewOpen(false);
        }}
      />
    </div>
  );
};
