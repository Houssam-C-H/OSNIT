import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { invoke } from '@tauri-apps/api/core';
import { useCaseStore } from '../store/useCaseStore';

interface WikiLinkRendererProps {
  content: string;
}

export const WikiLinkRenderer: React.FC<WikiLinkRendererProps> = ({ content }) => {
  const { setModalEntityName, setModalOpen } = useCaseStore();

  // SECURITY RATIONALE: DOMPurify must run BEFORE markdown parsing to strip any nested XSS
  // vectors in the raw text, ensuring no malicious HTML elements bypass the markdown renderer.
  // We use useMemo to only re-sanitize when the input content actually changes.
  const sanitizedContent = useMemo(() => {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [], // We only want raw text and what markdown outputs, no inline HTML allowed.
      ALLOWED_ATTR: [], // Strip all attributes from raw text to prevent payload injection
    });
  }, [content]);

  // Pre-process wiki links into custom markdown syntax we can intercept in react-markdown.
  // We'll replace [[Target Name]] with [Target Name](#wiki:Target Name)
  const processedContent = useMemo(() => {
    return sanitizedContent.replace(/\[\[(.*?)\]\]/g, '[$1](#wiki:$1)');
  }, [sanitizedContent]);

  const handleWikiLinkClick = async (e: React.MouseEvent<HTMLAnchorElement>, name: string) => {
    e.preventDefault();
    try {
      // IPC Call strictly defined in Tauri capability allowlist
      const entity = await invoke('get_entity_by_name', { name });
      
      if (entity) {
        // Here we could add logic to open a new tab with the entity data
        console.log("Entity found securely:", entity);
      } else {
        // Trigger auto-creation prompt
        setModalEntityName(name);
        setModalOpen(true);
      }
    } catch (error) {
      console.error("IPC Error fetching entity:", error);
    }
  };

  return (
    <div className="prose prose-invert max-w-none prose-slate">
      <ReactMarkdown
        components={{
          a: ({ node, href, children, ...props }) => {
            // Intercept our custom wiki link protocol
            if (href?.startsWith('#wiki:')) {
              // Decode URI component in case the regex captured spaces which markdown parsed
              const entityName = decodeURIComponent(href.replace('#wiki:', ''));
              return (
                <a
                  href="#"
                  onClick={(e) => handleWikiLinkClick(e, entityName)}
                  className="text-blue-400 hover:text-blue-300 underline cursor-pointer decoration-blue-500/50 font-semibold transition-colors"
                  {...props}
                >
                  {children}
                </a>
              );
            }
            // Block normal external links for OpSec (Air-Gapped environment)
            return (
              <span className="text-gray-500 cursor-not-allowed font-mono text-sm" title="External links disabled for OpSec">
                [BLOCKED_LINK: {children}]
              </span>
            );
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};
