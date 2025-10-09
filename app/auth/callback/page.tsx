"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Suspense } from "react";

function AuthCallbackForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = React.useState<string>("Completing sign-in...");

  React.useEffect(() => {
    const handleCodeExchange = async () => {
      const code = params?.get("code");
      const errorDescription = params?.get("error_description");

      if (errorDescription) {
        setMessage(errorDescription);
        return;
      }

      if (!supabaseBrowser) {
        setMessage("Auth client not initialized.");
        return;
      }

      // Explicitly exchange the OAuth code for a session to be safe
      if (code) {
        try {
          await supabaseBrowser.auth.exchangeCodeForSession(window.location.href);
        } catch (e: any) {
          // continue to next step; getSession below will show status
        }
      }

      // Get session and sync cookies to server so middleware sees it immediately
      const { data, error } = await supabaseBrowser.auth.getSession();
      if (error) {
        setMessage(error.message);
        return;
      }
      if (data.session?.access_token && data.session?.refresh_token) {
        try {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }),
          });
        } catch {}
      }

      // Navigate to home (or to redirect param if present)
      const redirectTo = params?.get("redirect") || "/";
      router.replace(redirectTo);
    };

    handleCodeExchange();
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-sm text-muted-foreground">{message}</div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    }>
      <AuthCallbackForm />
    </Suspense>
  );
}
