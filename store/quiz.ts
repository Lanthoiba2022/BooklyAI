"use client";
import { create } from "zustand";

export type QuizConfig = {
  mcq: number;
  saq: number;
  laq: number;
  difficulty: "easy" | "medium" | "hard" | "auto";
};

type QuizState = {
  config: QuizConfig;
  setConfig: (config: Partial<QuizConfig>) => void;
};

export const useQuizStore = create<QuizState>((set, get) => ({
  config: { mcq: 5, saq: 3, laq: 1, difficulty: "auto" },
  setConfig: (config) => set({ config: { ...get().config, ...config } }),
}));


