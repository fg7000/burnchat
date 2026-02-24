import { create } from "zustand";

export interface PendingAction {
  type: "message" | "upload";
  data: string | File[];
}

interface UIState {
  showCreditModal: boolean;
  creditModalReason: "manual" | "exhausted" | null;
  showAttachmentMenu: boolean;
  showSessionList: boolean;
  showSessionSidebar: boolean;
  showLoginPrompt: boolean;
  showSignInModal: boolean;
  pendingAction: PendingAction | null;

  setShowCreditModal: (show: boolean) => void;
  setCreditModalReason: (reason: "manual" | "exhausted" | null) => void;
  setShowAttachmentMenu: (show: boolean) => void;
  setShowSessionList: (show: boolean) => void;
  setShowSessionSidebar: (show: boolean) => void;
  setShowLoginPrompt: (show: boolean) => void;
  setShowSignInModal: (show: boolean) => void;
  setPendingAction: (action: PendingAction | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  showCreditModal: false,
  creditModalReason: null,
  showAttachmentMenu: false,
  showSessionList: false,
  showSessionSidebar: false,
  showLoginPrompt: false,
  showSignInModal: false,
  pendingAction: null,

  setShowCreditModal: (show) => set({ showCreditModal: show, ...(!show && { creditModalReason: null }) }),
  setCreditModalReason: (reason) => set({ creditModalReason: reason }),
  setShowAttachmentMenu: (show) => set({ showAttachmentMenu: show }),
  setShowSessionList: (show) => set({ showSessionList: show }),
  setShowSessionSidebar: (show) => set({ showSessionSidebar: show }),
  setShowLoginPrompt: (show) => set({ showLoginPrompt: show }),
  setShowSignInModal: (show) => set({ showSignInModal: show }),
  setPendingAction: (action) => set({ pendingAction: action }),
}));
