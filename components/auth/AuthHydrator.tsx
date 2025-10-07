"use client";
import * as React from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/auth";

export default function AuthHydrator({ children }: { children: React.ReactNode }) {
  const { setUser } = useAuthStore();

  React.useEffect(() => {
    let mounted = true;
    const applySessionToStore = (session: any) => {
      if (!mounted) return;
      if (session?.user) {
        setUser({
          id: null,
          publicId: session.user.id,
          email: session.user.email ?? null,
          displayName: (session.user.user_metadata as any)?.full_name ?? (session.user.user_metadata as any)?.name ?? null,
          avatarUrl: (session.user.user_metadata as any)?.avatar_url ?? null,
        });
      } else {
        // Do not clear store immediately on null; try a silent refresh first
      }
    };

    const init = async () => {
      if (!supabaseBrowser) return;
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (session) {
        applySessionToStore(session);
      } else {
        try { await supabaseBrowser.auth.refreshSession(); } catch {}
        const { data: s2 } = await supabaseBrowser.auth.getSession();
        applySessionToStore(s2.session);
        if (!s2.session) {
          setUser(null);
        }
      }
    };
    init();
    const { data: { subscription } = { subscription: undefined } } = supabaseBrowser?.auth.onAuthStateChange((_event, session) => {
      // Only clear on explicit sign-out; otherwise rely on refresh/visibility handler
      if (session?.user) {
        applySessionToStore(session);
      }
    }) as any || {};

    // When tab becomes visible again, re-sync session without changing UI state
    const onVisibility = async () => {
      if (!supabaseBrowser || document.visibilityState !== 'visible') return;
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (session?.user) {
          applySessionToStore(session);
          return;
        }
        try { await supabaseBrowser.auth.refreshSession(); } catch {}
        const { data: s2 } = await supabaseBrowser.auth.getSession();
        if (s2.session?.user) {
          applySessionToStore(s2.session);
        } else {
          setUser(null);
        }
      } catch {}
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [setUser]);

  return <>{children}</>;
}


