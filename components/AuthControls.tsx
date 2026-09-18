"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthControls() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email ?? null);
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      setLoggingOut(false);
      return;
    }

    window.location.href = "/login";
  }

  if (loading) {
    return (
      <p className="text-sm text-slate-400">
        Checking account...
      </p>
    );
  }

  if (!email) {
    return (
      <Link
        href="/login"
        className="text-sm font-medium text-white hover:text-slate-300"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div>
      <p className="truncate text-xs text-slate-400">
        Signed in as
      </p>

      <p className="mt-1 truncate text-sm text-white">
        {email}
      </p>

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="mt-3 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {loggingOut ? "Signing out..." : "Logout"}
      </button>
    </div>
  );
}