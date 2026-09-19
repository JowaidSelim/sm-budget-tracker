"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type Production = {
  id: string;
  production_name: string;
  stage_manager: string;
  assistant_stage_manager: string | null;
  vat_rate: number;
  allocation_date: string | null;
};

type ProductionBudget = {
  production_id: string;
  original_budget: number;
};

type BudgetAllocation = {
  id: string;
  production_id: string;
  name: string;
  category: string;
  allocated_amount: number;
  assigned_user_id: string | null;
};

type Purchase = {
  id: string;
  production_id: string;
  allocation_id: string | null;
  receipt: string;
  purchase_date: string;
  category: string;
  item: string;
  payment_method: string;
  supplier: string;
  total_including_vat: number;
};

export default function DashboardPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [
    production,
    setProduction,
  ] = useState<Production | null>(
    null
  );

  const [
    masterBudget,
    setMasterBudget,
  ] = useState<number | null>(
    null
  );

  const [
    allocations,
    setAllocations,
  ] = useState<
    BudgetAllocation[]
  >([]);

  const [
    purchases,
    setPurchases,
  ] = useState<Purchase[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    const activeProductionId =
      localStorage.getItem(
        "activeProductionId"
      );

    if (!activeProductionId) {
      setProduction(null);
      setMasterBudget(null);
      setAllocations([]);
      setPurchases([]);
      setLoading(false);
      return;
    }

    /*
      Basic production information.

      Master budget is deliberately
      not requested from productions.
    */
    const {
      data: productionData,
      error: productionError,
    } = await supabase
      .from("productions")
      .select(`
        id,
        production_name,
        stage_manager,
        assistant_stage_manager,
        vat_rate,
        allocation_date
      `)
      .eq(
        "id",
        activeProductionId
      )
      .single();

    if (
      productionError ||
      !productionData
    ) {
      console.error(
        productionError
      );

      setMessage(
        "Could not load the active production."
      );

      setLoading(false);
      return;
    }

    setProduction(
      productionData as Production
    );

    /*
      Secure master budget.

      Full-budget users receive this row.

      Restricted users receive no row.
    */
    const {
      data: budgetData,
      error: budgetError,
    } = await supabase
      .from(
        "production_budgets"
      )
      .select(`
        production_id,
        original_budget
      `)
      .eq(
        "production_id",
        activeProductionId
      )
      .maybeSingle();

    if (budgetError) {
      console.error(
        budgetError
      );
    }

    const secureBudget =
      budgetData as
        | ProductionBudget
        | null;

    setMasterBudget(
      secureBudget
        ? Number(
            secureBudget.original_budget
          )
        : null
    );

    /*
      TEAM-BASED ALLOCATION VISIBILITY

      SQL 22 makes category permissions
      the working boundary.

      Example:

      can_view_props = true

      → all Props allocations in this
        production become visible.

      assigned_user_id can still show
      who is responsible for an allocation,
      but does not isolate teammates.
    */
    const {
      data: allocationData,
      error: allocationError,
    } = await supabase
      .from(
        "budget_allocations"
      )
      .select(`
        id,
        production_id,
        name,
        category,
        allocated_amount,
        assigned_user_id
      `)
      .eq(
        "production_id",
        activeProductionId
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (allocationError) {
      console.error(
        allocationError
      );

      setMessage(
        "Some budget allocation information could not be loaded."
      );
    }

    setAllocations(
      (allocationData as
        BudgetAllocation[]) ??
        []
    );

    /*
      Purchase RLS handles category access.

      Teammates with the same category
      permissions work from the same
      purchase information.
    */
    const {
      data: purchaseData,
      error: purchaseError,
    } = await supabase
      .from("purchases")
      .select(`
        id,
        production_id,
        allocation_id,
        receipt,
        purchase_date,
        category,
        item,
        payment_method,
        supplier,
        total_including_vat
      `)
      .eq(
        "production_id",
        activeProductionId
      );

    if (purchaseError) {
      console.error(
        purchaseError
      );

      setMessage(
        "Purchase information could not be loaded."
      );

      setPurchases([]);
      setLoading(false);
      return;
    }

    setPurchases(
      (purchaseData as Purchase[]) ??
        []
    );

    setLoading(false);
  }

  function money(
    value: number
  ) {
    return `AED ${value.toLocaleString(
      "en-AE",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  }

  if (loading) {
    return (
      <main className="p-6 md:p-10">

        <p className="text-slate-500">
          Loading dashboard...
        </p>

      </main>
    );
  }

  if (!production) {
    return (
      <main className="p-6 text-slate-900 md:p-10">

        <div className="mx-auto max-w-7xl">

          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

            <p className="text-lg font-medium">
              No active production
            </p>

            <p className="mt-2 text-slate-500">
              Create or select a production to start tracking its budget.
            </p>

          </div>

        </div>

      </main>
    );
  }

  /*
    ======================================================
    SHARED CALCULATIONS
    ======================================================
  */

  const totalVisibleSpent =
    purchases.reduce(
      (
        total,
        purchase
      ) =>
        total +
        Number(
          purchase.total_including_vat
        ),
      0
    );

  const propsSpent =
    purchases
      .filter(
        (purchase) =>
          purchase.category ===
          "Props"
      )
      .reduce(
        (
          total,
          purchase
        ) =>
          total +
          Number(
            purchase.total_including_vat
          ),
        0
      );

  const stageManagementSpent =
    purchases
      .filter(
        (purchase) =>
          purchase.category ===
          "Stage Management"
      )
      .reduce(
        (
          total,
          purchase
        ) =>
          total +
          Number(
            purchase.total_including_vat
          ),
        0
      );

  const pettyCashSpent =
    purchases
      .filter(
        (purchase) =>
          purchase.payment_method ===
          "Petty Cash"
      )
      .reduce(
        (
          total,
          purchase
        ) =>
          total +
          Number(
            purchase.total_including_vat
          ),
        0
      );

  const creditCardSpent =
    purchases
      .filter(
        (purchase) =>
          purchase.payment_method ===
          "Credit Card"
      )
      .reduce(
        (
          total,
          purchase
        ) =>
          total +
          Number(
            purchase.total_including_vat
          ),
        0
      );

  const purchaseOrderSpent =
    purchases
      .filter(
        (purchase) =>
          purchase.payment_method ===
          "Purchase Order"
      )
      .reduce(
        (
          total,
          purchase
        ) =>
          total +
          Number(
            purchase.total_including_vat
          ),
        0
      );

  const vatRate =
    Number(
      production.vat_rate
    );

  const totalVat =
    purchases.reduce(
      (
        total,
        purchase
      ) => {
        const amount =
          Number(
            purchase.total_including_vat
          );

        const beforeVat =
          amount /
          (
            1 +
            vatRate /
              100
          );

        return (
          total +
          (
            amount -
            beforeVat
          )
        );
      },
      0
    );

  /*
    If this row exists, RLS has
    confirmed full master-budget access.
  */
  const hasFullBudgetAccess =
    masterBudget !== null;

  const remainingBudget =
    hasFullBudgetAccess
      ? masterBudget -
        totalVisibleSpent
      : null;

  const budgetUsed =
    hasFullBudgetAccess &&
    masterBudget >
      0
      ? (
          totalVisibleSpent /
          masterBudget
        ) *
        100
      : 0;

  /*
    ======================================================
    RESTRICTED TEAM DASHBOARD
    ======================================================

    Restricted users do not see the
    production master budget.

    They see all budget areas made
    available through their category
    permissions.
  */

  if (!hasFullBudgetAccess) {
    return (
      <main className="min-h-screen p-6 text-slate-900 md:p-10">

        <div className="mx-auto max-w-7xl">

          <div className="mb-8">

            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Production
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              {
                production.production_name
              }
            </h1>

            <p className="mt-2 text-slate-500">
              Your budget area
            </p>

          </div>

          {message && (
            <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {message}
            </div>
          )}

          {allocations.length ===
          0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

              <p className="text-lg font-semibold">
                No accessible budget area
              </p>

              <p className="mt-2 text-sm text-slate-500">
                You are a member of this production, but you do not currently have access to a budget area.
              </p>

            </div>
          ) : (
            <div className="grid gap-6">

              {allocations.map(
                (
                  allocation
                ) => {
                  const allocationSpent =
                    purchases
                      .filter(
                        (
                          purchase
                        ) =>
                          purchase.allocation_id ===
                          allocation.id
                      )
                      .reduce(
                        (
                          total,
                          purchase
                        ) =>
                          total +
                          Number(
                            purchase.total_including_vat
                          ),
                        0
                      );

                  const allocatedAmount =
                    Number(
                      allocation.allocated_amount
                    );

                  const allocationRemaining =
                    allocatedAmount -
                    allocationSpent;

                  const allocationUsed =
                    allocatedAmount >
                    0
                      ? (
                          allocationSpent /
                          allocatedAmount
                        ) *
                        100
                      : 0;

                  return (
                    <div
                      key={
                        allocation.id
                      }
                      className="rounded-2xl bg-white p-6 shadow-sm md:p-8"
                    >

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                        <div>

                          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                            {
                              allocation.category
                            }
                          </p>

                          <h2 className="mt-1 text-2xl font-bold">
                            {
                              allocation.name
                            }
                          </h2>

                        </div>

                        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          Budget Area
                        </span>

                      </div>

                      <div className="mt-8 grid gap-4 md:grid-cols-3">

                        <div className="rounded-xl bg-slate-50 p-5">

                          <p className="text-sm text-slate-500">
                            Allocated
                          </p>

                          <p className="mt-2 text-2xl font-bold">

                            {money(
                              allocatedAmount
                            )}

                          </p>

                        </div>

                        <div className="rounded-xl bg-slate-50 p-5">

                          <p className="text-sm text-slate-500">
                            Spent
                          </p>

                          <p className="mt-2 text-2xl font-bold">

                            {money(
                              allocationSpent
                            )}

                          </p>

                        </div>

                        <div className="rounded-xl bg-slate-50 p-5">

                          <p className="text-sm text-slate-500">
                            Remaining
                          </p>

                          <p className="mt-2 text-2xl font-bold">

                            {money(
                              allocationRemaining
                            )}

                          </p>

                        </div>

                      </div>

                      <div className="mt-6">

                        <div className="mb-2 flex items-center justify-between text-sm">

                          <span className="text-slate-500">
                            Budget Used
                          </span>

                          <span className="font-medium">

                            {allocationUsed.toFixed(
                              1
                            )}
                            %

                          </span>

                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">

                          <div
                            className="h-full rounded-full bg-slate-900"
                            style={{
                              width: `${Math.min(
                                Math.max(
                                  allocationUsed,
                                  0
                                ),
                                100
                              )}%`,
                            }}
                          />

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </div>

      </main>
    );
  }

  /*
    ======================================================
    FULL-BUDGET DASHBOARD
    ======================================================
  */

  return (
    <main className="min-h-screen p-6 text-slate-900 md:p-10">

      <div className="mx-auto max-w-7xl">

        <div className="mb-8">

          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Dashboard
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            {
              production.production_name
            }
          </h1>

          <p className="mt-2 text-slate-500">
            Full production budget overview
          </p>

        </div>

        {message && (
          <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-sm text-slate-500">
              Master Budget
            </p>

            <p className="mt-2 text-2xl font-bold">

              {money(
                masterBudget
              )}

            </p>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-sm text-slate-500">
              Total Spent
            </p>

            <p className="mt-2 text-2xl font-bold">

              {money(
                totalVisibleSpent
              )}

            </p>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-sm text-slate-500">
              Remaining
            </p>

            <p className="mt-2 text-2xl font-bold">

              {money(
                remainingBudget ??
                0
              )}

            </p>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-sm text-slate-500">
              Budget Used
            </p>

            <p className="mt-2 text-2xl font-bold">

              {budgetUsed.toFixed(
                1
              )}
              %

            </p>

          </div>

        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">

          <div className="mb-3 flex items-center justify-between">

            <h2 className="font-semibold">
              Budget Progress
            </h2>

            <span className="text-sm text-slate-500">

              {budgetUsed.toFixed(
                1
              )}
              %

            </span>

          </div>

          <div className="h-3 overflow-hidden rounded-full bg-slate-200">

            <div
              className="h-full rounded-full bg-slate-900"
              style={{
                width: `${Math.min(
                  Math.max(
                    budgetUsed,
                    0
                  ),
                  100
                )}%`,
              }}
            />

          </div>

        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold">
              Expenditure by Category
            </h2>

            <div className="mt-6 space-y-4">

              <div className="flex items-center justify-between">

                <span className="text-slate-500">
                  Props
                </span>

                <span className="font-semibold">

                  {money(
                    propsSpent
                  )}

                </span>

              </div>

              <div className="flex items-center justify-between">

                <span className="text-slate-500">
                  Stage Management
                </span>

                <span className="font-semibold">

                  {money(
                    stageManagementSpent
                  )}

                </span>

              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-4">

                <span className="font-medium">
                  Total
                </span>

                <span className="font-bold">

                  {money(
                    totalVisibleSpent
                  )}

                </span>

              </div>

            </div>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold">
              Payment Methods
            </h2>

            <div className="mt-6 space-y-4">

              <div className="flex items-center justify-between">

                <span className="text-slate-500">
                  Petty Cash
                </span>

                <span className="font-semibold">

                  {money(
                    pettyCashSpent
                  )}

                </span>

              </div>

              <div className="flex items-center justify-between">

                <span className="text-slate-500">
                  Credit Card
                </span>

                <span className="font-semibold">

                  {money(
                    creditCardSpent
                  )}

                </span>

              </div>

              <div className="flex items-center justify-between">

                <span className="text-slate-500">
                  Purchase Order
                </span>

                <span className="font-semibold">

                  {money(
                    purchaseOrderSpent
                  )}

                </span>

              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-4">

                <span className="font-medium">
                  Total VAT
                </span>

                <span className="font-bold">

                  {money(
                    totalVat
                  )}

                </span>

              </div>

            </div>

          </div>

        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">

          <div>

            <h2 className="text-lg font-semibold">
              Budget Allocations
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Budget areas within this production.
            </p>

          </div>

          {allocations.length ===
          0 ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-6 text-center">

              <p className="text-sm text-slate-500">
                No budget allocations have been created yet.
              </p>

            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">

              {allocations.map(
                (
                  allocation
                ) => {
                  const spent =
                    purchases
                      .filter(
                        (
                          purchase
                        ) =>
                          purchase.allocation_id ===
                          allocation.id
                      )
                      .reduce(
                        (
                          total,
                          purchase
                        ) =>
                          total +
                          Number(
                            purchase.total_including_vat
                          ),
                        0
                      );

                  const allocated =
                    Number(
                      allocation.allocated_amount
                    );

                  const remaining =
                    allocated -
                    spent;

                  return (
                    <div
                      key={
                        allocation.id
                      }
                      className="rounded-xl border border-slate-200 p-5"
                    >

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <p className="font-semibold">
                            {
                              allocation.name
                            }
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {
                              allocation.category
                            }
                          </p>

                        </div>

                        <p className="font-semibold">

                          {money(
                            allocated
                          )}

                        </p>

                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">

                        <div>

                          <p className="text-slate-500">
                            Spent
                          </p>

                          <p className="mt-1 font-medium">

                            {money(
                              spent
                            )}

                          </p>

                        </div>

                        <div>

                          <p className="text-slate-500">
                            Remaining
                          </p>

                          <p className="mt-1 font-medium">

                            {money(
                              remaining
                            )}

                          </p>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </div>

      </div>

    </main>
  );
}