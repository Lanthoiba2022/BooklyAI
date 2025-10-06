"use client";
import { useEffect, useState, useTransition } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { LogOut, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

export function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!supabaseBrowser) return;
      const { data } = await supabaseBrowser.auth.getUser();
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
      setDisplayName((data.user?.user_metadata as any)?.full_name ?? (data.user?.user_metadata as any)?.name ?? null);
    };
    init();
    const { data: sub } =
      supabaseBrowser?.auth.onAuthStateChange(async () => {
        const { data } = await supabaseBrowser!.auth.getUser();
        setEmail(data.user?.email ?? null);
        setDisplayName((data.user?.user_metadata as any)?.full_name ?? (data.user?.user_metadata as any)?.name ?? null);
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
        <a href="/login" aria-label="Sign in">
          <Button variant="ghost" size="icon">
            <LogIn className="h-4 w-4" />
          </Button>
        </a>
      </div>
    );
  }

  const nameOrEmail = displayName && displayName.trim().length > 0 ? displayName : email;
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
              await supabaseBrowser?.auth.signOut();
            } finally {
              // Optimistic UI + smooth redirect
              setEmail(null);
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


