import { create } from "zustand";

export interface MappingEntry {
  original: string;
  replacement: string;
  entity_type: string;
}

export interface EntityInfo {
  type: string;
  count: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  creditsUsed?: number;
  tokenCount?: { input: number; output: number };
  isStreaming?: boolean;
}

export interface DocumentInfo {
  filename: string;
  text: string;
  anonymizedText: string;
  mapping: MappingEntry[];
  entitiesFound: EntityInfo[];
  tokenCount: number;
  chunkCount?: number;
  status: "parsing" | "anonymizing" | "embedding" | "ready" | "error";
}

interface SessionState {
  // Auth
  token: string | null;
  userId: string | null;
  email: string | null;
  creditBalance: number;

  // Chat
  messages: ChatMessage[];
  isStreaming: boolean;

  // Documents
  documents: DocumentInfo[];
  currentMapping: MappingEntry[];
  showRealNames: boolean;

  // Session mode
  sessionMode: "quick" | "session";
  sessionId: string | null;
  sessionName: string;

  // Selected model
  selectedModel: string | null;

  // Actions - Auth
  setAuth: (token: string, userId: string, email: string, creditBalance: number) => void;
  clearAuth: () => void;
  setCreditBalance: (balance: number) => void;

  // Actions - Chat
  addMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  setStreamingComplete: (messageId: string, creditsUsed: number, tokenCount: { input: number; output: number }) => void;
  setIsStreaming: (streaming: boolean) => void;
  clearMessages: () => void;

  // Actions - Documents
  addDocument: (doc: DocumentInfo) => void;
  updateDocumentStatus: (filename: string, status: DocumentInfo["status"], extra?: Partial<DocumentInfo>) => void;
  setCurrentMapping: (mapping: MappingEntry[]) => void;
  addToMapping: (entries: MappingEntry[]) => void;
  toggleShowRealNames: () => void;
  clearDocuments: () => void;

  // Actions - Session
  setSessionMode: (mode: "quick" | "session") => void;
  setSessionId: (id: string | null) => void;
  setSessionName: (name: string) => void;
  setSelectedModel: (model: string | null) => void;

  // Reset
  resetSession: () => void;
}

const initialState = {
  token: null,
  userId: null,
  email: null,
  creditBalance: 50,
  messages: [],
  isStreaming: false,
  documents: [],
  currentMapping: [],
  showRealNames: false,
  sessionMode: "quick" as const,
  sessionId: null,
  sessionName: "Untitled Session",
  selectedModel: null,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  setAuth: (token, userId, email, creditBalance) =>
    set({ token, userId, email, creditBalance }),

  clearAuth: () =>
    set({ token: null, userId: null, email: null, creditBalance: 0 }),

  setCreditBalance: (balance) => set({ creditBalance: balance }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastAssistantMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        messages[lastIdx] = { ...messages[lastIdx], content };
      }
      return { messages };
    }),

  setStreamingComplete: (messageId, creditsUsed, tokenCount) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, isStreaming: false, creditsUsed, tokenCount } : m
      ),
      isStreaming: false,
      creditBalance: state.creditBalance - creditsUsed,
    })),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  clearMessages: () => set({ messages: [] }),

  addDocument: (doc) =>
    set((state) => ({ documents: [...state.documents, doc] })),

  updateDocumentStatus: (filename, status, extra) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.filename === filename ? { ...d, status, ...extra } : d
      ),
    })),

  setCurrentMapping: (mapping) => set({ currentMapping: mapping }),

  addToMapping: (entries) =>
    set((state) => {
      const existingOriginals = new Set(state.currentMapping.map((m) => m.original));
      const newEntries = entries.filter((e) => !existingOriginals.has(e.original));
      return { currentMapping: [...state.currentMapping, ...newEntries] };
    }),

  toggleShowRealNames: () =>
    set((state) => ({ showRealNames: !state.showRealNames })),

  clearDocuments: () =>
    set({ documents: [], currentMapping: [], sessionId: null, sessionMode: "quick" }),

  setSessionMode: (mode) => set({ sessionMode: mode }),
  setSessionId: (id) => set({ sessionId: id }),
  setSessionName: (name) => set({ sessionName: name }),
  setSelectedModel: (model) => set({ selectedModel: model }),

  resetSession: () => set(initialState),
}));
