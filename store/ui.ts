"use client";
import { create } from "zustand";

type UiState = {
  rightPanelOpen: boolean;
  sidebarOpen: boolean;
  centerView: "chat" | "files" | "progress" | "quiz";
  setRightPanelOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setCenterView: (view: "chat" | "files" | "progress" | "quiz") => void;
};

export const useUiStore = create<UiState>((set) => ({
  rightPanelOpen: true,
  sidebarOpen: true,
  centerView: "chat",
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCenterView: (view) => set({ centerView: view }),
}));


