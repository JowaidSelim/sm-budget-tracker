"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { usePathname } from "next/navigation";

import AuthControls from "@/components/AuthControls";
import ProductionSwitcher from "@/components/ProductionSwitcher";
import { createClient } from "@/lib/supabase/client";

type Membership = {
  can_export_reports: boolean;
  can_edit_production: boolean;
  can_manage_allocations: boolean;
};

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname =
    usePathname();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [
    isProductionMember,
    setIsProductionMember,
  ] = useState(false);

  const [
    canExportReports,
    setCanExportReports,
  ] = useState(false);

  const [
    canEditProduction,
    setCanEditProduction,
  ] = useState(false);

  const [
    canManageAllocations,
    setCanManageAllocations,
  ] = useState(false);

  const [
    permissionsLoaded,
    setPermissionsLoaded,
  ] = useState(false);

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/update-password";

  useEffect(() => {
    if (isAuthPage) {
      setPermissionsLoaded(true);
      return;
    }

    loadPermissions();
  }, []);

  async function loadPermissions() {
    const activeProductionId =
      localStorage.getItem(
        "activeProductionId"
      );

    if (!activeProductionId) {
      setIsProductionMember(false);
      setCanExportReports(false);
      setCanEditProduction(false);
      setCanManageAllocations(false);
      setPermissionsLoaded(true);
      return;
    }

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      setIsProductionMember(false);
      setCanExportReports(false);
      setCanEditProduction(false);
      setCanManageAllocations(false);
      setPermissionsLoaded(true);
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        "production_members"
      )
      .select(`
        can_export_reports,
        can_edit_production,
        can_manage_allocations
      `)
      .eq(
        "production_id",
        activeProductionId
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

    if (error) {
      console.error(error);

      setIsProductionMember(false);
      setCanExportReports(false);
      setCanEditProduction(false);
      setCanManageAllocations(false);
      setPermissionsLoaded(true);
      return;
    }

    const membership =
      data as Membership | null;

    setIsProductionMember(
      !!membership
    );

    setCanExportReports(
      membership?.can_export_reports ??
        false
    );

    setCanEditProduction(
      membership?.can_edit_production ??
        false
    );

    setCanManageAllocations(
      membership?.can_manage_allocations ??
        false
    );

    setPermissionsLoaded(true);
  }

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

          {/* Always visible:
              users may belong to multiple productions
              with different roles and permissions. */}
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

          {/* All members can see the team.
              Management controls belong inside Team page. */}
          {permissionsLoaded &&
            isProductionMember && (
              <Link
                href="/team"
                className={`rounded-lg px-4 py-3 transition ${
                  pathname.startsWith(
                    "/team"
                  )
                    ? "bg-slate-800"
                    : "hover:bg-slate-800"
                }`}
              >
                Team
              </Link>
            )}

          {/* Allocation management only */}
          {permissionsLoaded &&
            canManageAllocations && (
              <Link
                href="/allocations"
                className={`rounded-lg px-4 py-3 transition ${
                  pathname.startsWith(
                    "/allocations"
                  )
                    ? "bg-slate-800"
                    : "hover:bg-slate-800"
                }`}
              >
                Allocations
              </Link>
            )}

          {/* Reports only if allowed */}
          {permissionsLoaded &&
            canExportReports && (
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
            )}

          {/* Production settings only if allowed */}
          {permissionsLoaded &&
            canEditProduction && (
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
            )}

        </nav>

        <div className="mt-auto border-t border-slate-800 p-4">
          <AuthControls />
        </div>

      </aside>

      {/* Main Content */}

      <div className="min-w-0 flex-1 bg-slate-100 pb-20 md:pb-0">

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

        {/* Always visible */}
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

        {permissionsLoaded &&
          isProductionMember && (
            <Link
              href="/team"
              className={`text-xs font-medium ${
                pathname.startsWith(
                  "/team"
                )
                  ? "text-slate-900"
                  : "text-slate-500"
              }`}
            >
              Team
            </Link>
          )}

        {permissionsLoaded &&
          canManageAllocations && (
            <Link
              href="/allocations"
              className={`text-xs font-medium ${
                pathname.startsWith(
                  "/allocations"
                )
                  ? "text-slate-900"
                  : "text-slate-500"
              }`}
            >
              Allocations
            </Link>
          )}

        {permissionsLoaded &&
          canExportReports && (
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
          )}

        {permissionsLoaded &&
          canEditProduction && (
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
          )}

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
      onClick={
        handleLogout
      }
      className="text-xs font-medium text-red-600"
    >
      Logout
    </button>
  );
}