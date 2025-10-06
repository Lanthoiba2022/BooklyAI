"use client";
import { create } from "zustand";

type AuthUser = {
  id: number | null;
  publicId: string | null;
  email: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));


