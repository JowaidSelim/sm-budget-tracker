"use client";

import {
  FormEvent,
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

type BudgetRow = {
  production_id: string;
  original_budget: number;
};

type Allocation = {
  id: string;
  name: string;
  category:
    | "Props"
    | "Stage Management";
  allocated_amount: number;
};

export default function SettingsPage() {
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
    productionName,
    setProductionName,
  ] = useState("");

  const [
    stageManager,
    setStageManager,
  ] = useState("");

  const [
    assistantStageManager,
    setAssistantStageManager,
  ] = useState("");

  const [
    originalBudget,
    setOriginalBudget,
  ] = useState("");

  const [
    propsBudget,
    setPropsBudget,
  ] = useState("");

  const [
    stageManagementBudget,
    setStageManagementBudget,
  ] = useState("");

  const [
    vatRate,
    setVatRate,
  ] = useState("");

  const [
    allocationDate,
    setAllocationDate,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setMessage("");
    setSuccess(false);

    const activeProductionId =
      localStorage.getItem(
        "activeProductionId"
      );

    if (!activeProductionId) {
      setProduction(null);
      setLoading(false);
      return;
    }

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
        "Could not load production settings."
      );

      setLoading(false);
      return;
    }

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

      setMessage(
        "Production loaded, but the master budget could not be loaded."
      );

      setLoading(false);
      return;
    }

    const {
      data: allocationData,
      error: allocationError,
    } = await supabase
      .from(
        "budget_allocations"
      )
      .select(`
        id,
        name,
        category,
        allocated_amount
      `)
      .eq(
        "production_id",
        activeProductionId
      );

    if (allocationError) {
      console.error(
        allocationError
      );

      setMessage(
        "Production loaded, but budget allocations could not be loaded."
      );

      setLoading(false);
      return;
    }

    const currentProduction =
      productionData as Production;

    const currentBudget =
      budgetData as BudgetRow | null;

    const allocations =
      (allocationData as Allocation[]) ??
      [];

    const propsAllocation =
      allocations.find(
        (allocation) =>
          allocation.category ===
            "Props" &&
          allocation.name
            .trim()
            .toLowerCase() ===
            "props"
      );

    const stageManagementAllocation =
      allocations.find(
        (allocation) =>
          allocation.category ===
            "Stage Management" &&
          allocation.name
            .trim()
            .toLowerCase() ===
            "stage management"
      );

    setProduction(
      currentProduction
    );

    setProductionName(
      currentProduction.production_name
    );

    setStageManager(
      currentProduction.stage_manager
    );

    setAssistantStageManager(
      currentProduction.assistant_stage_manager ??
        ""
    );

    setVatRate(
      String(
        currentProduction.vat_rate
      )
    );

    setAllocationDate(
      currentProduction.allocation_date ??
        ""
    );

    setOriginalBudget(
      currentBudget
        ? String(
            currentBudget.original_budget
          )
        : ""
    );

    setPropsBudget(
      propsAllocation
        ? String(
            propsAllocation.allocated_amount
          )
        : "0"
    );

    setStageManagementBudget(
      stageManagementAllocation
        ? String(
            stageManagementAllocation.allocated_amount
          )
        : "0"
    );

    setLoading(false);
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!production) {
      return;
    }

    setSaving(true);
    setMessage("");
    setSuccess(false);

    const masterBudget =
      Number(
        originalBudget
      );

    const props =
      Number(
        propsBudget
      );

    const stageManagement =
      Number(
        stageManagementBudget
      );

    const vat =
      Number(
        vatRate
      );

    if (
      !productionName.trim() ||
      !stageManager.trim() ||
      masterBudget < 0 ||
      props < 0 ||
      stageManagement < 0 ||
      vat < 0
    ) {
      setMessage(
        "Please check the production details."
      );

      setSaving(false);
      return;
    }

    const {
      error,
    } = await supabase.rpc(
      "update_production_with_budgets",
      {
        production_id_input:
          production.id,

        production_name_input:
          productionName.trim(),

        stage_manager_input:
          stageManager.trim(),

        assistant_stage_manager_input:
          assistantStageManager.trim(),

        master_budget_input:
          masterBudget,

        props_budget_input:
          props,

        stage_management_budget_input:
          stageManagement,

        vat_rate_input:
          vat,

        allocation_date_input:
          allocationDate ||
          null,
      }
    );

    if (error) {
      console.error(
        error
      );

      setMessage(
        error.message
      );

      setSaving(false);
      return;
    }

    setProduction({
      ...production,

      production_name:
        productionName.trim(),

      stage_manager:
        stageManager.trim(),

      assistant_stage_manager:
        assistantStageManager.trim() ||
        null,

      vat_rate:
        vat,

      allocation_date:
        allocationDate ||
        null,
    });

    setSuccess(true);

    setMessage(
      "Production settings and default budgets updated successfully."
    );

    setSaving(false);
  }

  const masterBudgetNumber =
    Number(originalBudget) || 0;

  const propsBudgetNumber =
    Number(propsBudget) || 0;

  const stageManagementBudgetNumber =
    Number(stageManagementBudget) || 0;

  const allocatedTotal =
    propsBudgetNumber +
    stageManagementBudgetNumber;

  const unallocatedBudget =
    masterBudgetNumber -
    allocatedTotal;

  if (loading) {
    return (
      <main className="p-6 md:p-10">
        <p className="text-slate-500">
          Loading settings...
        </p>
      </main>
    );
  }

  if (!production) {
    return (
      <main className="p-6 text-slate-900 md:p-10">
        <div className="mx-auto max-w-4xl">

          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

            <p className="text-lg font-medium">
              No active production
            </p>

            <p className="mt-2 text-slate-500">
              Select a production before editing settings.
            </p>

          </div>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-4xl">

        <div className="mb-8">

          <h1 className="text-3xl font-bold">
            Settings
          </h1>

          <p className="mt-2 text-slate-500">
            Manage the active production.
          </p>

        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">

          <div className="mb-6">

            <h2 className="text-xl font-semibold">
              Production Settings
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Update production details and default budgets.
            </p>

          </div>

          <form
            onSubmit={
              handleSave
            }
            className="space-y-6"
          >

            <div>

              <label className="mb-2 block text-sm font-medium">
                Production Name
              </label>

              <input
                type="text"
                value={
                  productionName
                }
                onChange={(
                  event
                ) =>
                  setProductionName(
                    event.target.value
                  )
                }
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              />

            </div>

            <div className="grid gap-5 md:grid-cols-2">

              <div>

                <label className="mb-2 block text-sm font-medium">
                  Stage Manager
                </label>

                <input
                  type="text"
                  value={
                    stageManager
                  }
                  onChange={(
                    event
                  ) =>
                    setStageManager(
                      event.target.value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium">
                  Assistant Stage Manager
                </label>

                <input
                  type="text"
                  value={
                    assistantStageManager
                  }
                  onChange={(
                    event
                  ) =>
                    setAssistantStageManager(
                      event.target.value
                    )
                  }
                  placeholder="Optional"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                />

              </div>

            </div>

            <div>

              <label className="mb-2 block text-sm font-medium">
                Master Budget
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  originalBudget
                }
                onChange={(
                  event
                ) =>
                  setOriginalBudget(
                    event.target.value
                  )
                }
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              />

              <p className="mt-2 text-xs text-slate-500">
                Full production budget. Restricted members will not receive this value.
              </p>

            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

              <div>

                <h3 className="font-semibold">
                  Default Allocations
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Update the starting Props and Stage Management budget allocations.
                </p>

              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">

                <div>

                  <label className="mb-2 block text-sm font-medium">
                    Props Budget
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      propsBudget
                    }
                    onChange={(
                      event
                    ) =>
                      setPropsBudget(
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-500"
                  />

                </div>

                <div>

                  <label className="mb-2 block text-sm font-medium">
                    Stage Management Budget
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      stageManagementBudget
                    }
                    onChange={(
                      event
                    ) =>
                      setStageManagementBudget(
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-500"
                  />

                </div>

              </div>

              <div className="mt-5 border-t border-slate-200 pt-4">

                <div className="flex justify-between gap-4 text-sm">

                  <span className="text-slate-500">
                    Default Allocations
                  </span>

                  <span className="font-medium">
                    AED{" "}
                    {allocatedTotal.toFixed(
                      2
                    )}
                  </span>

                </div>

                <div className="mt-2 flex justify-between gap-4 text-sm">

                  <span className="text-slate-500">
                    Master Budget Remaining
                  </span>

                  <span
                    className={`font-medium ${
                      unallocatedBudget < 0
                        ? "text-red-600"
                        : ""
                    }`}
                  >
                    AED{" "}
                    {unallocatedBudget.toFixed(
                      2
                    )}
                  </span>

                </div>

                {unallocatedBudget < 0 && (
                  <p className="mt-3 text-xs text-red-600">
                    The default allocations currently exceed the master budget.
                  </p>
                )}

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Custom allocations are managed separately on the Allocations page and are not changed here.
                </p>

              </div>

            </div>

            <div className="grid gap-5 md:grid-cols-2">

              <div>

                <label className="mb-2 block text-sm font-medium">
                  VAT %
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    vatRate
                  }
                  onChange={(
                    event
                  ) =>
                    setVatRate(
                      event.target.value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium">
                  Allocation Date
                </label>

                <input
                  type="date"
                  value={
                    allocationDate
                  }
                  onChange={(
                    event
                  ) =>
                    setAllocationDate(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                />

              </div>

            </div>

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

            <div className="flex justify-end">

              <button
                type="submit"
                disabled={
                  saving
                }
                className="rounded-xl bg-slate-900 px-6 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </div>

          </form>

        </div>

      </div>
    </main>
  );
}