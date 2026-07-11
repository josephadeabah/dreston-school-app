"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export interface StaffProfile {
  id: string;
  full_name: string;
  role: "admin" | "teacher" | "accountant" | "front_desk";
}

export function useAuth(redirectIfLoggedOut = true) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        await loadProfile(data.session.user.id);
      } else if (redirectIfLoggedOut) {
        router.replace("/login");
      }
      setLoading(false);
    }

    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from("staff_profiles")
        .select("id, full_name, role")
        .eq("id", userId)
        .single();
      if (mounted && data) setProfile(data as StaffProfile);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession.user.id);
      } else if (redirectIfLoggedOut) {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return { session, profile, loading, signOut };
}
