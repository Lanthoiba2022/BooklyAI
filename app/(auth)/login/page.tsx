"use client";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabaseClient";
import * as React from "react";

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [magicEmail, setMagicEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const signInWithGoogle = async () => {
    if (!supabaseBrowser) return;
    setLoading(true);
    await supabaseBrowser.auth.signInWithOAuth({ provider: "google" });
    setLoading(false);
  };

  const signInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseBrowser) return;
    setLoading(true);
    await supabaseBrowser.auth.signInWithPassword({ email, password });
    setLoading(false);
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseBrowser) return;
    setLoading(true);
    await supabaseBrowser.auth.signInWithOtp({ email: magicEmail });
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <Button onClick={signInWithGoogle} className="w-full" disabled={loading}>
          Continue with Google
        </Button>

        <div className="border rounded-md p-4 space-y-3">
          <div className="text-sm font-medium">Email & password</div>
          <form className="space-y-2" onSubmit={signInWithEmail}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-10 rounded-md border px-3"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="your password"
              className="w-full h-10 rounded-md border px-3"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              Sign in
            </Button>
          </form>
        </div>

        <div className="border rounded-md p-4 space-y-3">
          <div className="text-sm font-medium">Magic link</div>
          <form className="space-y-2" onSubmit={sendMagicLink}>
            <input
              type="email"
              required
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-10 rounded-md border px-3"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              Send magic link
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}


