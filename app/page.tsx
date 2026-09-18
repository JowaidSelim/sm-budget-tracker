"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Production = {
  id: string;
  production_name: string;
  stage_manager: string;
  assistant_stage_manager: string | null;
  original_budget: number;
  vat_rate: number;
};

type Purchase = {
  id: string;
  category: string;
  payment_method: string;
  total_including_vat: number;
};

export default function Home() {
  const supabase = useMemo(() => createClient(), []);

  const [production, setProduction] =
    useState<Production | null>(null);

  const [purchases, setPurchases] =
    useState<Purchase[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const activeProductionId =
      localStorage.getItem("activeProductionId");

    if (!activeProductionId) {
      setLoading(false);
      return;
    }

    const { data: productionData } =
      await supabase
        .from("productions")
        .select(`
          id,
          production_name,
          stage_manager,
          assistant_stage_manager,
          original_budget,
          vat_rate
        `)
        .eq("id", activeProductionId)
        .single();

    if (!productionData) {
      setLoading(false);
      return;
    }

    setProduction(productionData as Production);

    const { data: purchaseData } =
      await supabase
        .from("purchases")
        .select(`
          id,
          category,
          payment_method,
          total_including_vat
        `)
        .eq("production_id", activeProductionId);

    setPurchases(
      (purchaseData as Purchase[]) ?? []
    );

    setLoading(false);
  }

  if (loading) {
    return (
      <main className="p-6 md:p-10">
        <p>Loading dashboard...</p>
      </main>
    );
  }

  if (!production) {
    return (
      <main className="p-6 md:p-10">
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-medium">
            No active production
          </p>
        </div>
      </main>
    );
  }

  const budget =
    Number(production.original_budget);

  const vatRate =
    Number(production.vat_rate);

  const totalSpent =
    purchases.reduce(
      (sum, purchase) =>
        sum + Number(purchase.total_including_vat),
      0
    );

  const remaining =
    budget - totalSpent;

  const budgetUsed =
    budget > 0
      ? (totalSpent / budget) * 100
      : 0;

  const propsTotal =
    purchases
      .filter((p) => p.category === "Props")
      .reduce(
        (sum, p) =>
          sum + Number(p.total_including_vat),
        0
      );

  const stageManagementTotal =
    purchases
      .filter(
        (p) => p.category === "Stage Management"
      )
      .reduce(
        (sum, p) =>
          sum + Number(p.total_including_vat),
        0
      );

  const pettyCashTotal =
    purchases
      .filter(
        (p) => p.payment_method === "Petty Cash"
      )
      .reduce(
        (sum, p) =>
          sum + Number(p.total_including_vat),
        0
      );

  const creditCardTotal =
    purchases
      .filter(
        (p) => p.payment_method === "Credit Card"
      )
      .reduce(
        (sum, p) =>
          sum + Number(p.total_including_vat),
        0
      );

  const purchaseOrderTotal =
    purchases
      .filter(
        (p) =>
          p.payment_method === "Purchase Order"
      )
      .reduce(
        (sum, p) =>
          sum + Number(p.total_including_vat),
        0
      );

  const vatMultiplier =
    1 + vatRate / 100;

  const totalVat =
    purchases.reduce((sum, purchase) => {
      const total =
        Number(purchase.total_including_vat);

      const beforeVat =
        vatMultiplier > 0
          ? total / vatMultiplier
          : total;

      return sum + (total - beforeVat);
    }, 0);

  const paymentMethodTotal =
    pettyCashTotal +
    creditCardTotal +
    purchaseOrderTotal;

  const reconciliationDifference =
    totalSpent - paymentMethodTotal;

  const isBalanced =
    Math.abs(reconciliationDifference) < 0.01;

  function money(value: number) {
    return `AED ${value.toLocaleString("en-AE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return (
    <main className="p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            {production.production_name}
          </h1>

          <p className="mt-2 text-slate-500">
            Stage Management Budget Overview
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Stage Manager: {production.stage_manager}

            {production.assistant_stage_manager &&
              ` • ASM: ${production.assistant_stage_manager}`}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Original Budget
            </p>

            <p className="mt-2 text-3xl font-bold">
              {money(budget)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Spent
            </p>

            <p className="mt-2 text-3xl font-bold">
              {money(totalSpent)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Remaining
            </p>

            <p className="mt-2 text-3xl font-bold">
              {money(remaining)}
            </p>
          </div>

        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">

          <div className="mb-3 flex justify-between">
            <span>Budget Used</span>

            <span className="font-semibold">
              {budgetUsed.toFixed(1)}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-900"
              style={{
                width: `${Math.min(
                  Math.max(budgetUsed, 0),
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

            <div className="mt-5 space-y-4">
              <div className="flex justify-between">
                <span>Props</span>
                <span>{money(propsTotal)}</span>
              </div>

              <div className="flex justify-between">
                <span>Stage Management</span>
                <span>
                  {money(stageManagementTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              Payment Methods
            </h2>

            <div className="mt-5 space-y-4">
              <div className="flex justify-between">
                <span>Petty Cash</span>
                <span>{money(pettyCashTotal)}</span>
              </div>

              <div className="flex justify-between">
                <span>Credit Card</span>
                <span>{money(creditCardTotal)}</span>
              </div>

              <div className="flex justify-between">
                <span>Purchase Order</span>
                <span>
                  {money(purchaseOrderTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Total VAT Paid
            </p>

            <p className="mt-2 text-2xl font-bold">
              {money(totalVat)}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              VAT rate: {vatRate}%
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Reconciliation
            </p>

            <p
              className={`mt-2 text-2xl font-bold ${
                isBalanced
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {isBalanced
                ? "Balanced ✓"
                : "Check Entries"}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Difference:{" "}
              {money(reconciliationDifference)}
            </p>
          </div>

        </div>

      </div>
    </main>
  );
}