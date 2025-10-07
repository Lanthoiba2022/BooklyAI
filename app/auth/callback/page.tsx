"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
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

      // If PKCE/OAuth redirect comes back, let Supabase detect session in URL
      // and then navigate home. For email confirm/magic link, the same applies.
      const { data, error } = await supabaseBrowser.auth.getSession();
      if (error) {
        setMessage(error.message);
        return;
      }

      // If no active session yet, attempt to parse from URL fragment
      // Supabase client with detectSessionInUrl=true should have processed it already
      // but we give it a brief moment.
      if (!data.session && code) {
        // give the client a tick to process the URL hash
        await new Promise((r) => setTimeout(r, 250));
      }

      // Navigate to home (or to redirect param if present)
      const redirectTo = params?.get("next") || "/";
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


