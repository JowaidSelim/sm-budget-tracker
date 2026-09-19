"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessage("Enter your email address.");
      return;
    }

    setLoading(true);
    setMessage("");

    const redirectTo =
      `${window.location.origin}/auth/callback?next=/update-password`;

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo,
        }
      );

    if (error) {
      console.error(error);

      setMessage(
        "Could not send the reset email. Please try again."
      );

      setLoading(false);
      return;
    }

    setSent(true);

    setMessage(
      "If an account exists for that email, a password reset link has been sent."
    );

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">

        <h1 className="text-2xl font-bold text-slate-900">
          Reset password
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter the email address connected to your account and we'll send you a reset link.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6"
        >
          <label className="text-sm font-medium text-slate-700">
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            disabled={loading || sent}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 disabled:bg-slate-100"
            required
          />

          <button
            type="submit"
            disabled={loading || sent}
            className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Sending..."
              : sent
                ? "Email Sent"
                : "Send Reset Link"}
          </button>
        </form>

        {message && (
          <div className="mt-5 rounded-xl bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-700">
            {message}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Back to login
          </Link>
        </div>

      </div>
    </main>
  );
}