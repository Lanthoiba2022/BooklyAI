"use client";

import * as React from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";

export default function AuthHydrator({ children }: { children: React.ReactNode }) {
  const { setUser } = useAuthStore();
  const router = useRouter();
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!supabaseBrowser || initializedRef.current) return;
    initializedRef.current = true;

    let mounted = true;

    const applySessionToStore = (session: any) => {
      if (!mounted) return;
      
      if (session?.user) {
        setUser({
          id: null,
          publicId: session.user.id,
          email: session.user.email ?? null,
          displayName: (session.user.user_metadata as any)?.full_name ?? 
                       (session.user.user_metadata as any)?.name ?? null,
          avatarUrl: (session.user.user_metadata as any)?.avatar_url ?? null,
        });
      }
    };

    const init = async () => {
      try {
        // Handle OAuth callback (PKCE flow)
        const url = new URL(window.location.href);
        const hasCode = url.searchParams.get('code');
        const hasState = url.searchParams.get('state');

        if (hasCode && hasState) {
          try {
            // Exchange code for session
            await supabaseBrowser!.auth.exchangeCodeForSession(window.location.href);
            
            // Get the new session immediately
            const { data: { session } } = await supabaseBrowser!.auth.getSession();
            if (session?.user) {
              applySessionToStore(session);
            }

            // Clean URL parameters
            url.searchParams.delete('code');
            url.searchParams.delete('state');
            url.searchParams.delete('redirect_to');
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
            
            // Trigger router refresh after OAuth
            router.refresh();
          } catch (err) {
            console.error("Error exchanging code:", err);
          }
        }

        // Get current session
        const { data: { session } } = await supabaseBrowser!.auth.getSession();
        // Only apply when a valid session exists; avoid clearing on transient null
        if (session?.user) {
          applySessionToStore(session);
        }

      } catch (err) {
        console.error("Auth initialization error:", err);
        setUser(null);
      }
    };

    init();

    // Listen to auth state changes
    const { data: { subscription } } = supabaseBrowser!.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        try { router.refresh(); } catch {}
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          applySessionToStore(session);
        }
        try { router.refresh(); } catch {}
      }
      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          applySessionToStore(session);
          try { router.refresh(); } catch {}
        }
      }
    });

    // Handle visibility change - refresh session when tab becomes visible
    const onVisibility = async () => {
      if (!supabaseBrowser || document.visibilityState !== 'visible') return;
      
      try {
        const { data: { session } } = await supabaseBrowser!.auth.getSession();
        if (session?.user) {
          applySessionToStore(session);
        }
      } catch (err) {
        console.error("Error on visibility change:", err);
      }
    };

    // Handle storage events (session changes in other tabs)
    const onStorage = async (e: StorageEvent) => {
      if (!e.key) return;
      // Supabase may use default `sb-...` key or a custom key (our client uses "sb-bookly-auth")
      const key = e.key;
      if (!(key.startsWith('sb-') || key === 'sb-bookly-auth')) return;
      
      try {
        const { data: { session } } = await supabaseBrowser!.auth.getSession();
        if (session?.user) {
          applySessionToStore(session);
          try { router.refresh(); } catch {}
        }
      } catch (err) {
        console.error("Error on storage event:", err);
      }
    };

    // Periodic token refresh (every 5 minutes)
    const interval = setInterval(async () => {
      try {
        const { data: { session } } = await supabaseBrowser!.auth.getSession();
        if (session?.user) {
          await supabaseBrowser!.auth.refreshSession();
        }
      } catch (err) {
        console.error("Error refreshing session:", err);
      }
    }, 5 * 60 * 1000); // 5 minutes

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, [setUser, router]);

  return <>{children}</>;
}