import { create } from 'zustand';

// SECURITY RATIONALE: The store only handles UI state (tabs and modals). 
// It does NOT cache sensitive OSINT data persistently. Sensitive data is always 
// requested fresh from the encrypted local SQLite database via IPC.

interface Tab {
  id: string;
  type: 'ENTITY' | 'SEARCH' | 'CASE_FILE' | 'MARKDOWN' | 'IMPORT' | 'EXTRACT' | 'EXPORT';
  title: string;
  dataId?: string; // e.g., the Entity ID
}

interface CaseStore {
  // Workspace / Tab State
  activeTabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  // Wiki-Link Modal State
  isCreateModalOpen: boolean;
  modalEntityName: string;
  modalSourceEntityId: string | null;
  setModalOpen: (isOpen: boolean) => void;
  setModalEntityName: (name: string) => void;
  setModalSourceEntityId: (id: string | null) => void;

  // Global Graph View State
  isGraphViewOpen: boolean;
  setGraphViewOpen: (isOpen: boolean) => void;

  // Workspace / Case File State
  currentWorkspace: string | null;
  isWorkspaceModalOpen: boolean;
  setWorkspace: (name: string | null) => void;
  setWorkspaceModalOpen: (isOpen: boolean) => void;
}

export const useCaseStore = create<CaseStore>((set) => ({
  activeTabs: [],
  activeTabId: null,

  addTab: (tab) =>
    set((state) => {
      // Prevent duplicate tabs based on id
      if (state.activeTabs.find((t) => t.id === tab.id)) {
        return { activeTabId: tab.id };
      }
      return {
        activeTabs: [...state.activeTabs, tab],
        activeTabId: tab.id,
      };
    }),

  closeTab: (tabId) =>
    set((state) => {
      const newTabs = state.activeTabs.filter((t) => t.id !== tabId);
      return {
        activeTabs: newTabs,
        activeTabId: state.activeTabId === tabId 
          ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null)
          : state.activeTabId,
      };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  isCreateModalOpen: false,
  modalEntityName: '',
  modalSourceEntityId: null,
  
  setModalOpen: (isOpen) => set({ isCreateModalOpen: isOpen }),
  setModalEntityName: (name) => set({ modalEntityName: name }),
  setModalSourceEntityId: (id) => set({ modalSourceEntityId: id }),

  isGraphViewOpen: false,
  setGraphViewOpen: (isOpen) => set({ isGraphViewOpen: isOpen }),

  currentWorkspace: null,
  isWorkspaceModalOpen: false,
  setWorkspace: (name) => set({ currentWorkspace: name }),
  setWorkspaceModalOpen: (isOpen) => set({ isWorkspaceModalOpen: isOpen }),
}));
