"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error("We couldn't sign you in. Check your email and password.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-600 via-violet-500 to-blush-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Arched crest header — the signature motif */}
        <div className="arch-frame bg-white/10 backdrop-blur-sm border border-white/20 pt-10 pb-8 px-8 text-center mb-[-1px]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-400 text-plum-900 font-display text-xl font-bold shadow-soft">
            DE
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Dreston Elite Montessori School
          </h1>
          <p className="mt-2 font-display italic text-sm text-blush-100">
            &ldquo;The fear of the Lord is the beginning of wisdom.&rdquo;
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl rounded-t-none shadow-soft border border-white/40 p-8 space-y-5"
        >
          <div>
            <h2 className="font-display text-lg font-semibold text-plum-800">
              Staff sign in
            </h2>
            <p className="text-sm text-plum-800/60 mt-1">
              Use the login your school administrator gave you.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="you@drestonelite.edu.gh"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-xs text-center text-plum-800/50 pt-2">
            Don&apos;t have an account? Ask your school admin to add you under Staff.
          </p>
        </form>
      </div>
    </div>
  );
}
