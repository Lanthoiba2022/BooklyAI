"use client";
import { create } from "zustand";

export type QuizConfig = {
  mcq: number;
  saq: number;
  laq: number;
  difficulty: "easy" | "medium" | "hard" | "auto";
};

export type Question = {
  id: number;
  type: "mcq" | "saq" | "laq";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  page: number;
  lineStart?: number;
  lineEnd?: number;
  topic: string;
};

export type Quiz = {
  id: number;
  pdfId: number;
  pdfName?: string;
  config: QuizConfig;
  questions: Question[];
  createdAt: string;
};

export type QuizResults = {
  score: number;
  totalScore: number;
  percentage: number;
  feedback: Array<{
    questionId: number;
    correct: boolean;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
    score: number;
    feedback?: string;
  }>;
};

type QuizState = {
  config: QuizConfig;
  currentQuiz: Quiz | null;
  quizAnswers: Record<number, string>;
  quizResults: QuizResults | null;
  isQuizModalOpen: boolean;
  currentQuestionIndex: number;
  isGenerating: boolean;
  isSubmitting: boolean;
  
  // Actions
  setConfig: (config: Partial<QuizConfig>) => void;
  setCurrentQuiz: (quiz: Quiz | null) => void;
  setAnswer: (questionId: number, answer: string) => void;
  setCurrentQuestionIndex: (index: number) => void;
  submitQuiz: (results: QuizResults) => void;
  resetQuiz: () => void;
  toggleQuizModal: (open?: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
};

export const useQuizStore = create<QuizState>((set, get) => ({
  config: { mcq: 5, saq: 3, laq: 1, difficulty: "auto" },
  currentQuiz: null,
  quizAnswers: {},
  quizResults: null,
  isQuizModalOpen: false,
  currentQuestionIndex: 0,
  isGenerating: false,
  isSubmitting: false,
  
  setConfig: (config) => set({ config: { ...get().config, ...config } }),
  setCurrentQuiz: (quiz) => set({ 
    currentQuiz: quiz, 
    currentQuestionIndex: 0,
    quizAnswers: {},
    quizResults: null
  }),
  setAnswer: (questionId, answer) => set((state) => ({
    quizAnswers: { ...state.quizAnswers, [questionId]: answer }
  })),
  setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),
  submitQuiz: (results) => set({ quizResults: results }),
  resetQuiz: () => set({ 
    currentQuiz: null, 
    quizAnswers: {}, 
    quizResults: null, 
    currentQuestionIndex: 0 
  }),
  toggleQuizModal: (open) => set((state) => ({ 
    isQuizModalOpen: open !== undefined ? open : !state.isQuizModalOpen 
  })),
  setGenerating: (generating) => set({ isGenerating: generating }),
  setSubmitting: (submitting) => set({ isSubmitting: submitting }),
}));


