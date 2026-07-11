"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? "/dashboard" : "/login");
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-blush-50">
      <p className="font-body text-plum-800/60">Loading Dreston Elite Montessori…</p>
    </div>
  );
}
