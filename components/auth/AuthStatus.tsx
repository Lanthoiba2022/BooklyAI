"use client";
import { useEffect, useState, useTransition } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { LogOut, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    // Prefer global store for immediate updates after OAuth
    if (user?.email) {
      setEmail(user.email);
      setDisplayName(user.displayName ?? null);
    } else {
      setEmail(null);
      setDisplayName(null);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const { data: sub } =
      supabaseBrowser?.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session) {
          setEmail(null);
          setDisplayName(null);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const { data } = await supabaseBrowser!.auth.getUser();
          if (!mounted) return;
          setEmail(data.user?.email ?? null);
          setDisplayName((data.user?.user_metadata as any)?.full_name ?? (data.user?.user_metadata as any)?.name ?? null);
        }
      }) ?? ({} as any);
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (!email) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-600 truncate">Not signed in</div>
        <a href="/signin" aria-label="Sign in">
          <Button variant="ghost" size="icon">
            <LogIn className="h-4 w-4" />
          </Button>
        </a>
      </div>
    );
  }

  const nameOrEmail = email;
  const shortLabel = nameOrEmail.length > 26 ? nameOrEmail.slice(0, 23) + "…" : nameOrEmail;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-xs text-zinc-600 truncate" title={nameOrEmail}>
        {shortLabel}
      </div>
      <Button
        aria-label="Sign out"
        variant="ghost"
        size="icon"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            try {
              // Clear state immediately for better UX
              setEmail(null);
              setDisplayName(null);
              await supabaseBrowser?.auth.signOut();
              // Force clear local session to avoid stale UI in other listeners
              try { localStorage.removeItem("sb-bookly-auth"); } catch {}
              try { document.cookie = `bookly_auth=; Path=/; Max-Age=0; SameSite=Lax`; } catch {}
            } catch (error) {
              console.error("Error signing out:", error);
            } finally {
              try {
                if (typeof window !== 'undefined') {
                  window.location.assign("/");
                  return;
                }
              } catch {}
              router.replace("/");
            }
          });
        }}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}


