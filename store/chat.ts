"use client";
import { create } from "zustand";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Array<{ page: number; line?: number; quote?: string }>;
  createdAt: number;
};

type ChatState = {
  chatId: number | null;
  messages: ChatMessage[];
  setChatId: (id: number | null) => void;
  addMessage: (message: ChatMessage) => void;
  reset: () => void;
};

export const useChatStore = create<ChatState>((set) => ({
  chatId: null,
  messages: [],
  setChatId: (id) => set({ chatId: id, messages: [] }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  reset: () => set({ chatId: null, messages: [] }),
}));


