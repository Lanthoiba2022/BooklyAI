"use client";

import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabaseClient";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, LogIn } from "lucide-react";
import { useAuthStore } from "@/store/auth";

export default function SignInPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [magicEmail, setMagicEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuthStore();

  React.useEffect(() => {
    if (params?.get("checkEmail")) {
      setInfo("We sent you a confirmation email. Please check your inbox.");
    }
  }, [params]);

  const signInWithGoogle = async () => {
    if (!supabaseBrowser) return;
    setLoading(true);
    setError(null);
    setInfo(null);

    await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: { prompt: "select_account" },
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    
    setLoading(false);
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseBrowser) return;

    setLoading(true);
    setError(null);
    setInfo(null);

    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email: magicEmail,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setInfo("Magic link sent. Check your email to continue.");
  };

  const signInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseBrowser) return;

    setLoading(true);
    setError(null);
    setInfo(null);

    const { data, error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // FIXED: Immediately update store with session data
    if (data.session?.user) {
      const u = data.session.user as any;
      setUser({
        id: null,
        publicId: u.id ?? null,
        email: u.email ?? null,
        displayName: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
        avatarUrl: u.user_metadata?.avatar_url ?? null,
      });
    }

    setLoading(false);

    // Small delay to ensure store propagation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Navigate to home
    if (typeof window !== 'undefined') {
      window.location.href = "/";
    } else {
      router.replace("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="px-6 pt-6 pb-2 text-center space-y-1">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Choose your preferred sign in method</p>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {error && <div className="text-sm text-red-600 text-center">{error}</div>}
          {info && <div className="text-sm text-green-600 text-center">{info}</div>}

          <Button onClick={signInWithGoogle} className="w-full" disabled={loading}>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="space-y-4">
            <form onSubmit={signInWithEmail} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="signin-email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="signin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-10 rounded-md border bg-background px-3 pl-10 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="signin-password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 rounded-md border bg-background px-3 pl-10 pr-10 text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    aria-label="Toggle password"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(v => !v)}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                <LogIn className="mr-2 h-4 w-4" />
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Magic Link</span>
              </div>
            </div>

            <form onSubmit={sendMagicLink} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="magic-email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="magic-email"
                    type="email"
                    required
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-10 rounded-md border bg-background px-3 pl-10 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <Button type="submit" variant="secondary" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Magic Link"}
              </Button>
            </form>

            <div className="text-sm text-center text-muted-foreground">
              Don't have an account? <a className="underline" href="/signup">Sign Up Now</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}