import { create } from "zustand";

interface UIState {
  showCreditModal: boolean;
  showAttachmentMenu: boolean;
  showSessionList: boolean;
  showSessionSidebar: boolean;
  showLoginPrompt: boolean;

  setShowCreditModal: (show: boolean) => void;
  setShowAttachmentMenu: (show: boolean) => void;
  setShowSessionList: (show: boolean) => void;
  setShowSessionSidebar: (show: boolean) => void;
  setShowLoginPrompt: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  showCreditModal: false,
  showAttachmentMenu: false,
  showSessionList: false,
  showSessionSidebar: false,
  showLoginPrompt: false,

  setShowCreditModal: (show) => set({ showCreditModal: show }),
  setShowAttachmentMenu: (show) => set({ showAttachmentMenu: show }),
  setShowSessionList: (show) => set({ showSessionList: show }),
  setShowSessionSidebar: (show) => set({ showSessionSidebar: show }),
  setShowLoginPrompt: (show) => set({ showLoginPrompt: show }),
}));
