"use client";
import { create } from "zustand";

export type PdfFile = {
  id: number | null;
  publicId: string | null;
  name: string;
  url: string | null;
  currentPage: number;
  totalPages: number | null;
};

type PdfState = {
  current: PdfFile | null;
  setCurrent: (file: PdfFile | null) => void;
  setCurrentPage: (page: number) => void;
};

export const usePdfStore = create<PdfState>((set, get) => ({
  current: null,
  setCurrent: (file) => set({ current: file }),
  setCurrentPage: (page) => {
    const current = get().current;
    if (!current) return;
    set({ current: { ...current, currentPage: page } });
  },
}));


