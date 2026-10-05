import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import { mergeAttributes } from '@tiptap/core';
import tippy from 'tippy.js';
import { invoke } from '@tauri-apps/api/core';
import { useCaseStore } from '../../store/useCaseStore';

// ------------------------------------------------------------------
// 1. Mention Dropdown List Component (Tippy)
// ------------------------------------------------------------------
const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.name, exists: item.exists });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') { upHandler(); return true; }
      if (event.key === 'ArrowDown') { downHandler(); return true; }
      if (event.key === 'Enter') { enterHandler(); return true; }
      return false;
    },
  }));

  return (
    <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-lg overflow-hidden min-w-[240px] z-50">
      {props.items.length > 0 ? (
        props.items.map((item: any, index: number) => (
          <button
            className={`w-full text-left px-4 py-2.5 text-sm transition font-mono ${
              index === selectedIndex ? 'bg-emerald-900/50 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            {item.exists ? (
              <span className="flex items-center gap-2"><span className="text-emerald-500">●</span> {item.name}</span>
            ) : (
              <span className="flex items-center gap-2"><span className="text-amber-500 font-bold">+</span> Create: {item.name}</span>
            )}
          </button>
        ))
      ) : (
        <div className="px-4 py-3 text-slate-500 text-sm italic">No matching targets...</div>
      )}
    </div>
  );
});

// ------------------------------------------------------------------
// 2. Inline React Node Component for the Entity Pill
// ------------------------------------------------------------------
const WikiLinkComponent = (props: any) => {
  const { node } = props;
  const name = node.attrs.label || node.attrs.id;
  const exists = node.attrs.exists;
  
  const { setModalEntityName, setModalOpen, addTab } = useCaseStore();

  const handleClick = async () => {
    if (exists) {
      try {
        // Find entity to get its ID, then open dossier
        const entity = await invoke('get_entity_by_name', { name }) as any;
        if (entity && entity.id) {
           addTab({ id: `entity-${entity.id}`, type: 'ENTITY', title: name, dataId: entity.id });
        } else {
           setModalEntityName(name); setModalOpen(true);
        }
      } catch(e) {
        setModalEntityName(name); setModalOpen(true);
      }
    } else {
      setModalEntityName(name); setModalOpen(true);
    }
  };

  return (
    <NodeViewWrapper className="inline-block" as="span">
      <span 
        onClick={handleClick}
        className={`px-1.5 py-0.5 rounded cursor-pointer mx-1 border font-bold text-sm tracking-wide ${
          exists 
          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800 hover:bg-emerald-900' 
          : 'bg-amber-950/50 text-amber-300 border-dashed border-amber-800 hover:bg-amber-900/80'
        }`}
      >
        [[{name}]]
      </span>
    </NodeViewWrapper>
  );
};

// ------------------------------------------------------------------
// 3. Tiptap Extension Configuration
// ------------------------------------------------------------------
const WikiLinkExtension = Mention.extend({
  name: 'wikiLink',
  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
      exists: { default: false },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-type="wikiLink"]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'wikiLink' }), node.attrs.label]
  },
  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkComponent)
  },
});

// ------------------------------------------------------------------
// 4. Menu Bar for Tiptap
// ------------------------------------------------------------------
const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  const buttonClass = (isActive: boolean) => `p-1.5 rounded transition ${isActive ? 'bg-emerald-900 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`;

  return (
    <div className="flex items-center gap-1 border-b border-slate-800 pb-4 mb-4">
      <button onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} className={buttonClass(editor.isActive('bold'))} title="Bold">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"></path></svg>
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} className={buttonClass(editor.isActive('italic'))} title="Italic">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4-4m-4 4l-4-4"></path></svg>
      </button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()} className={buttonClass(editor.isActive('strike'))} title="Strikethrough">
        <span className="font-serif italic line-through text-sm px-1">S</span>
      </button>
      
      <div className="w-px h-4 bg-slate-800 mx-2"></div>
      
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={buttonClass(editor.isActive('heading', { level: 1 }))} title="Heading 1">
        <span className="font-bold text-sm px-1">H1</span>
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={buttonClass(editor.isActive('heading', { level: 2 }))} title="Heading 2">
        <span className="font-bold text-sm px-1">H2</span>
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={buttonClass(editor.isActive('heading', { level: 3 }))} title="Heading 3">
        <span className="font-bold text-sm px-1">H3</span>
      </button>

      <div className="w-px h-4 bg-slate-800 mx-2"></div>

      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={buttonClass(editor.isActive('bulletList'))} title="Bullet List">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
      </button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={buttonClass(editor.isActive('blockquote'))} title="Blockquote">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
      </button>
    </div>
  );
};

// ------------------------------------------------------------------
// 5. Main Editor Workspace Component
// ------------------------------------------------------------------
interface Props { initialContent?: string; }

export const EditorWorkspace: React.FC<Props> = ({ initialContent = '' }) => {
  const [title, setTitle] = useState('New Intelligence Note');
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotes, setSavedNotes] = useState<any[]>([]);
  const { currentWorkspace } = useCaseStore();

  const fetchNotes = async () => {
    try {
      const data: any[] = await invoke('get_all_notes');
      setSavedNotes(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [currentWorkspace]);

  const loadNote = async (id: string, noteTitle: string) => {
    setTitle(noteTitle);
    setCurrentNoteId(id);
    try {
      const content: string = await invoke('get_note_content', { id });
      editor?.commands.setContent(content || '');
    } catch (err) {
      console.error("Failed to load note content", err);
      editor?.commands.setContent('');
    }
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Permanently delete this note?")) return;
    try {
      await invoke('delete_entity', { id });
      if (currentNoteId === id) {
        setCurrentNoteId(null);
        setTitle('New Intelligence Note');
        editor?.commands.setContent('');
      }
      fetchNotes();
    } catch (err: any) {
      console.error("Failed to delete note:", err);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      WikiLinkExtension.configure({
        HTMLAttributes: { class: 'wiki-link' },
        suggestion: {
          char: '[[',
          items: async ({ query }) => {
            if (!query) return [];
            try {
              let results: any[] = [];
              try {
                results = await invoke('search_entities', { query });
              } catch (e) {
                console.warn("Backend search_entities missing or failed, using empty results.");
              }
              const mapped = results.map(r => ({ id: r.id, name: r.primary_name, exists: true }));
              
              if (!mapped.find(m => m.name.toLowerCase() === query.toLowerCase())) {
                mapped.push({ id: query, name: query, exists: false });
              }
              return mapped;
            } catch (err) {
              return [{ id: query, name: query, exists: false }];
            }
          },
          render: () => {
            let reactRenderer: any;
            let popup: any;
            return {
              onStart: (props: any) => {
                reactRenderer = new ReactRenderer(MentionList, { props, editor: props.editor });
                if (!props.clientRect) return;
                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: reactRenderer.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate(props: any) {
                reactRenderer.updateProps(props);
                if (!props.clientRect) return;
                popup[0].setProps({ getReferenceClientRect: props.clientRect });
              },
              onKeyDown(props: any) {
                if (props.event.key === 'Escape') { popup[0].hide(); return true; }
                return reactRenderer.ref?.onKeyDown(props);
              },
              onExit() {
                popup[0].destroy();
                reactRenderer.destroy();
              },
            };
          },
        },
      }),
    ],
    content: initialContent || '<p>Start typing here... Type <strong>[[</strong> to link or create an entity.</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-slate max-w-none focus:outline-none min-h-[500px] leading-relaxed',
      },
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const htmlContent = editor?.getHTML() || '';
      const response: any = await invoke('save_markdown_note', { 
        payload: { 
          id: currentNoteId,
          title, 
          content: htmlContent 
        } 
      });
      
      if (response && response.id) {
        setCurrentNoteId(response.id);
      }
      
      await fetchNotes();
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  return (
    <div className="flex h-full bg-slate-950 w-full overflow-hidden">
      
      {/* Notes Sidebar */}
      <div className="w-64 border-r border-slate-800 bg-slate-900/40 flex flex-col flex-shrink-0 h-full">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Case Notes</h2>
          <button 
            onClick={() => { setTitle('New Intelligence Note'); editor?.commands.setContent(''); }}
            className="text-emerald-500 hover:text-emerald-400 transition" title="New Note"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {savedNotes.map(note => (
            <div
              key={note.id}
              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition group cursor-pointer ${
                currentNoteId === note.id ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400 border' : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
              }`}
              onClick={() => loadNote(note.id, note.primary_name)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <span className="font-bold text-sm truncate">{note.primary_name}</span>
              </div>
              <button 
                onClick={(e) => handleDeleteNote(note.id, e)}
                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition flex-shrink-0 p-1"
                title="Delete Note"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          ))}
          {savedNotes.length === 0 && (
            <div className="text-center text-slate-600 text-sm italic mt-8 px-4">No notes saved in this case file.</div>
          )}
        </div>
      </div>

      {/* Editor Panel */}
      <div className="flex-1 flex flex-col h-full bg-slate-900/60 custom-scrollbar overflow-y-auto relative">
        <div className="w-full max-w-4xl mx-auto flex flex-col h-full px-8 py-12">
          
          {/* Header Controls */}
          <div className="flex items-center justify-between pb-6">
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-none text-4xl font-bold text-slate-100 focus:outline-none placeholder-slate-600 w-2/3 tracking-tight"
              placeholder="Intelligence Ledger Title"
            />
            <div className="flex gap-2">
              <button 
                className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded text-sm font-bold transition flex items-center gap-2 border border-slate-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                Attach File
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-emerald-900/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-800 px-6 py-2 rounded text-sm font-bold transition flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                {isSaving ? 'Saving...' : 'Commit Ledger'}
              </button>
            </div>
          </div>

          <MenuBar editor={editor} />

          {/* Tiptap Unified Editor */}
          <div className="flex-1 bg-transparent text-slate-200 font-serif text-lg pb-32">
            <EditorContent editor={editor} />
          </div>
          
        </div>
      </div>
    </div>
  );
};
