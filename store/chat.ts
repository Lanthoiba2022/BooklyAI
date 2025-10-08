"use client";
import { create } from "zustand";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Array<{ page: number; text?: string }>;
  createdAt: number;
};

type ChatState = {
  chatId: number | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  setChatId: (id: number | null) => void;
  addMessage: (message: ChatMessage) => void;
  startAssistantMessage: () => void;
  appendAssistantDelta: (delta: string) => void;
  setAssistantCitations: (cites: Array<{ page: number; text?: string }>) => void;
  reset: () => void;
};

export const useChatStore = create<ChatState>((set) => ({
  chatId: null,
  messages: [],
  isStreaming: false,
  setChatId: (id) => set((s) => ({ chatId: id, messages: s.messages })),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  startAssistantMessage: () => set((s) => ({
    isStreaming: true,
    messages: [...s.messages, { id: `${Date.now()}-assistant`, role: "assistant", content: "", createdAt: Date.now() }],
  })),
  appendAssistantDelta: (delta) => set((s) => {
    if (s.messages.length === 0) return s;
    const last = s.messages[s.messages.length - 1];
    if (last.role !== "assistant") return s;
    const updated = { ...last, content: (last.content || "") + delta };
    return { ...s, messages: [...s.messages.slice(0, -1), updated] };
  }),
  setAssistantCitations: (cites) => set((s) => {
    if (s.messages.length === 0) return s;
    const last = s.messages[s.messages.length - 1];
    if (last.role !== "assistant") return s;
    const updated = { ...last, citations: cites };
    return { ...s, messages: [...s.messages.slice(0, -1), updated] };
  }),
  reset: () => set({ chatId: null, messages: [], isStreaming: false }),
}));


