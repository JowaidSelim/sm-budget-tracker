"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = useMemo(() => createClient(), []);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  function cleanUsername(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
  }

  function handleUsernameChange(value: string) {
    setUsername(
      cleanUsername(value)
    );
  }

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");
    setSuccess(false);

    const cleanEmail =
      email.trim().toLowerCase();

    const cleanDisplayName =
      displayName.trim();

    const cleanUser =
      cleanUsername(username);

    if (!cleanDisplayName) {
      setMessage(
        "Please enter your name."
      );
      return;
    }

    if (
      cleanUser.length < 3 ||
      cleanUser.length > 30
    ) {
      setMessage(
        "Username must be between 3 and 30 characters."
      );
      return;
    }

    if (
      !/^[a-z0-9_]+$/.test(
        cleanUser
      )
    ) {
      setMessage(
        "Username can contain only letters, numbers and underscores."
      );
      return;
    }

    if (!cleanEmail) {
      setMessage(
        "Please enter your email address."
      );
      return;
    }

    if (password.length < 6) {
      setMessage(
        "Password must be at least 6 characters."
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

    const { data, error } =
      await supabase.auth.signUp({
        email: cleanEmail,
        password,

        options: {
          data: {
            username:
              cleanUser,

            display_name:
              cleanDisplayName,
          },
        },
      });

    if (error) {
      console.error(error);

      const errorText =
        error.message.toLowerCase();

      if (
        errorText.includes(
          "database"
        ) ||
        errorText.includes(
          "duplicate"
        ) ||
        errorText.includes(
          "unique"
        )
      ) {
        setMessage(
          "That username may already be taken. Try another username."
        );
      } else {
        setMessage(
          error.message
        );
      }

      setLoading(false);
      return;
    }

    /*
      If email confirmation is disabled,
      Supabase may immediately create a session.
    */
    if (data.session) {
      window.location.href =
        "/";
      return;
    }

    /*
      Your current Supabase setup requires
      email confirmation, so normally the
      user reaches this state.
    */
    setSuccess(true);

    setMessage(
      "Account created successfully. Check your email to confirm your account, then come back and log in."
    );

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">
            Create Account
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Create your SM Budget Tracker account.
          </p>
        </div>

        <form
          onSubmit={
            handleSignup
          }
          className="space-y-5"
        >

          {/* Display Name */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Name
            </label>

            <input
              type="text"
              value={
                displayName
              }
              onChange={(
                event
              ) =>
                setDisplayName(
                  event.target.value
                )
              }
              required
              autoComplete="name"
              placeholder="Jowaid Selim"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>

          {/* Username */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Username
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                @
              </span>

              <input
                type="text"
                value={
                  username
                }
                onChange={(
                  event
                ) =>
                  handleUsernameChange(
                    event.target.value
                  )
                }
                required
                minLength={3}
                maxLength={30}
                autoComplete="username"
                placeholder="jowaid"
                className="w-full rounded-xl border border-slate-300 py-3 pl-8 pr-4 text-slate-900 outline-none transition focus:border-slate-500"
              />
            </div>

            <p className="mt-2 text-xs text-slate-500">
              3–30 characters. Letters, numbers and underscores only.
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>

            <input
              type="email"
              value={
                email
              }
              onChange={(
                event
              ) =>
                setEmail(
                  event.target.value
                )
              }
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
            />

            <p className="mt-2 text-xs text-slate-500">
              Your email is used for login and account confirmation. It will not be shown to production team members.
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Password
            </label>

            <input
              type="password"
              value={
                password
              }
              onChange={(
                event
              ) =>
                setPassword(
                  event.target.value
                )
              }
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Confirm Password
            </label>

            <input
              type="password"
              value={
                confirmPassword
              }
              onChange={(
                event
              ) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Repeat your password"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>

          {/* Message */}
          {message && (
            <div
              className={`rounded-xl px-4 py-3 text-sm ${
                success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={
              loading
            }
            className="w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Creating account..."
              : "Create Account"}
          </button>

        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}

          <Link
            href="/login"
            className="font-medium text-slate-900 hover:underline"
          >
            Log in
          </Link>
        </div>

      </div>
    </main>
  );
}