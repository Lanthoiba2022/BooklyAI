"use client";

import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabaseClient";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User } from "lucide-react";
import { useAuthStore } from "@/store/auth";

export default function SignupPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [magicEmail, setMagicEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const router = useRouter();
  const { setUser } = useAuthStore();

  const signUpWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseBrowser) return;

    setLoading(true);
    setError(null);

    const { data, error } = await supabaseBrowser.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
      },
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // If email confirmation is enabled, user must verify
    if (data.user && !data.session) {
      setLoading(false);
      router.replace("/signin?checkEmail=1");
      return;
    }

    // FIXED: Immediately update store with user data
    if (data.session?.user) {
      const u = data.session.user as any;
      setUser({
        id: null,
        publicId: u.id ?? null,
        email: u.email ?? null,
        displayName: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
        avatarUrl: u.user_metadata?.avatar_url ?? null,
      });
      try { document.cookie = `bookly_auth=1; Path=/; SameSite=Lax`; } catch {}
    }

    setLoading(false);

    // Use a small delay to ensure store is updated before navigation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Navigate to intended destination or home
    const url = new URL(window.location.href);
    const redirect = url.searchParams.get("redirect") || "/";
    if (typeof window !== 'undefined') {
      window.location.href = redirect;
    } else {
      router.replace(redirect);
    }
  };

  const signUpWithGoogle = async () => {
    if (!supabaseBrowser) return;
    setLoading(true);
    setError(null);

    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: { prompt: "select_account" },
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
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
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setInfo("Magic link sent. Check your email to continue.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="px-6 pt-6 pb-2 text-center space-y-1">
          <h1 className="text-2xl font-bold">Get started</h1>
          <p className="text-sm text-muted-foreground">Choose your preferred sign up method</p>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {error && <div className="text-sm text-red-600 text-center">{error}</div>}
          {info && <div className="text-sm text-green-600 text-center">{info}</div>}

          <Button onClick={signUpWithGoogle} className="w-full" disabled={loading}>
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
            <form className="space-y-3" onSubmit={signUpWithEmail}>
              <div className="space-y-1">
                <label htmlFor="name" className="text-sm font-medium">Full name (optional)</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ada Lovelace"
                    className="w-full h-10 rounded-md border bg-background px-3 pl-10 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="signup-email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="signup-email"
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
                <label htmlFor="signup-password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="signup-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a password"
                    className="w-full h-10 rounded-md border bg-background px-3 pl-10 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
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

            <form className="space-y-3" onSubmit={sendMagicLink}>
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
              Have an account? <a className="underline" href="/signin">Sign In Now</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}