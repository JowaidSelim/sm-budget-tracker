"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthControls from "@/components/AuthControls";
import ProductionSwitcher from "@/components/ProductionSwitcher";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname =
    usePathname();

  const isAuthPage =
    pathname === "/login";

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-slate-100">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen md:flex">

      {/* Desktop Sidebar */}
      <aside className="hidden min-h-screen w-64 shrink-0 flex-col bg-slate-900 text-white md:flex">

        <div className="p-6">
          <div className="text-xl font-bold">
            SM Budget Tracker
          </div>

          <div className="mt-6">
            <ProductionSwitcher />
          </div>
        </div>

        <nav className="flex flex-col gap-2 px-4">

          <Link
            href="/"
            className={`rounded-lg px-4 py-3 transition ${
              pathname === "/"
                ? "bg-slate-800"
                : "hover:bg-slate-800"
            }`}
          >
            Dashboard
          </Link>

          <Link
            href="/productions"
            className={`rounded-lg px-4 py-3 transition ${
              pathname.startsWith(
                "/productions"
              )
                ? "bg-slate-800"
                : "hover:bg-slate-800"
            }`}
          >
            Productions
          </Link>

          <Link
            href="/purchases"
            className={`rounded-lg px-4 py-3 transition ${
              pathname.startsWith(
                "/purchases"
              )
                ? "bg-slate-800"
                : "hover:bg-slate-800"
            }`}
          >
            Purchases
          </Link>

          <Link
            href="/reports"
            className={`rounded-lg px-4 py-3 transition ${
              pathname.startsWith(
                "/reports"
              )
                ? "bg-slate-800"
                : "hover:bg-slate-800"
            }`}
          >
            Reports
          </Link>

          <Link
            href="/settings"
            className={`rounded-lg px-4 py-3 transition ${
              pathname.startsWith(
                "/settings"
              )
                ? "bg-slate-800"
                : "hover:bg-slate-800"
            }`}
          >
            Settings
          </Link>

        </nav>

        <div className="mt-auto border-t border-slate-800 p-4">
          <AuthControls />
        </div>

      </aside>

      {/* Main Content */}
      <div className="min-w-0 flex-1 bg-slate-100 pb-20 md:pb-0">

        {/* Mobile Production Bar */}
        <div className="border-b border-slate-200 bg-slate-900 p-4 text-white md:hidden">
          <ProductionSwitcher />
        </div>

        {children}
      </div>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white p-3 md:hidden">

        <Link
          href="/"
          className={`text-xs font-medium ${
            pathname === "/"
              ? "text-slate-900"
              : "text-slate-500"
          }`}
        >
          Dashboard
        </Link>

        <Link
          href="/productions"
          className={`text-xs font-medium ${
            pathname.startsWith(
              "/productions"
            )
              ? "text-slate-900"
              : "text-slate-500"
          }`}
        >
          Productions
        </Link>

        <Link
          href="/purchases"
          className={`text-xs font-medium ${
            pathname.startsWith(
              "/purchases"
            )
              ? "text-slate-900"
              : "text-slate-500"
          }`}
        >
          Purchases
        </Link>

        <Link
          href="/reports"
          className={`text-xs font-medium ${
            pathname.startsWith(
              "/reports"
            )
              ? "text-slate-900"
              : "text-slate-500"
          }`}
        >
          Reports
        </Link>

        <Link
          href="/settings"
          className={`text-xs font-medium ${
            pathname.startsWith(
              "/settings"
            )
              ? "text-slate-900"
              : "text-slate-500"
          }`}
        >
          Settings
        </Link>

        <MobileLogout />

      </nav>

    </div>
  );
}

function MobileLogout() {
  async function handleLogout() {
    const { createClient } =
      await import(
        "@/lib/supabase/client"
      );

    const supabase =
      createClient();

    await supabase.auth.signOut();

    window.location.href =
      "/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-xs font-medium text-red-600"
    >
      Logout
    </button>
  );
}