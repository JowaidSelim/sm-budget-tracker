"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router =
    useRouter();

  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    if (
      password.length < 8
    ) {
      setMessage(
        "Password must be at least 8 characters."
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setMessage(
        "Passwords do not match."
      );

      return;
    }

    setLoading(true);

    const {
      error,
    } =
      await supabase.auth.updateUser({
        password,
      });

    if (error) {
      console.error(error);

      setMessage(
        "Could not update the password. The reset link may have expired."
      );

      setLoading(false);
      return;
    }

    await supabase.auth.signOut();

    router.replace(
      "/login?password-reset=success"
    );

    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">

        <h1 className="text-2xl font-bold text-slate-900">
          Choose a new password
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter a new password for your SM Budget Tracker account.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
        >

          <div>
            <label className="text-sm font-medium text-slate-700">
              New password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Confirm new password
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Updating..."
              : "Update Password"}
          </button>

        </form>

        {message && (
          <div className="mt-5 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        )}

      </div>
    </main>
  );
}