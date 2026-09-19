"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type AccessLevel =
  | "Owner"
  | "Admin"
  | "Member"
  | "Viewer";

type ProductionRow = {
  id: string;
  production_name: string;
  stage_manager: string;
  assistant_stage_manager: string | null;
  vat_rate: number;
  allocation_date: string | null;
  created_at: string;
};

type BudgetRow = {
  production_id: string;
  original_budget: number;
};

type MembershipRow = {
  production_id: string;
  access_level: AccessLevel;
  role: string;
  can_edit_production: boolean;
};

type Production = ProductionRow & {
  original_budget: number | null;
  membership: MembershipRow | null;
};

export default function ProductionsPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [
    productions,
    setProductions,
  ] = useState<Production[]>([]);

  const [
    activeProductionId,
    setActiveProductionId,
  ] = useState<string | null>(
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
  ] = useState("12000");

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
  ] = useState("5");

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
    deletingId,
    setDeletingId,
  ] = useState<string | null>(
    null
  );

  const [
    message,
    setMessage,
  ] = useState("");

  useEffect(() => {
    loadProductions();
  }, []);

  async function loadProductions() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      setMessage(
        "Could not identify the signed-in user."
      );

      setLoading(false);
      return;
    }

    /*
      Supabase RLS should return only
      productions this user is allowed
      to see.
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
        allocation_date,
        created_at
      `)
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (productionError) {
      console.error(
        productionError
      );

      setMessage(
        productionError.message
      );

      setLoading(false);
      return;
    }

    const rows =
      (productionData as ProductionRow[]) ??
      [];

    /*
      Master budgets are protected by
      their own RLS.

      Restricted members simply won't
      receive a budget row.
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
      `);

    if (budgetError) {
      console.error(
        budgetError
      );

      setMessage(
        "Productions loaded, but some budget information could not be loaded."
      );
    }

    const budgets =
      (budgetData as BudgetRow[]) ??
      [];

    const budgetMap =
      new Map<string, number>();

    budgets.forEach(
      (budget) => {
        budgetMap.set(
          budget.production_id,
          Number(
            budget.original_budget
          )
        );
      }
    );

    /*
      Memberships are loaded for the
      current user across all productions.

      This matters because the same user
      can have different roles in different
      productions.
    */
    const {
      data: membershipData,
      error: membershipError,
    } = await supabase
      .from(
        "production_members"
      )
      .select(`
        production_id,
        access_level,
        role,
        can_edit_production
      `)
      .eq(
        "user_id",
        user.id
      );

    if (membershipError) {
      console.error(
        membershipError
      );

      setMessage(
        "Productions loaded, but membership permissions could not be loaded."
      );
    }

    const memberships =
      (membershipData as MembershipRow[]) ??
      [];

    const membershipMap =
      new Map<
        string,
        MembershipRow
      >();

    memberships.forEach(
      (membership) => {
        membershipMap.set(
          membership.production_id,
          membership
        );
      }
    );

    const combinedProductions:
      Production[] =
      rows.map(
        (production) => ({
          ...production,

          original_budget:
            budgetMap.get(
              production.id
            ) ?? null,

          membership:
            membershipMap.get(
              production.id
            ) ?? null,
        })
      );

    setProductions(
      combinedProductions
    );

    const savedActiveId =
      localStorage.getItem(
        "activeProductionId"
      );

    const activeStillExists =
      savedActiveId &&
      combinedProductions.some(
        (production) =>
          production.id ===
          savedActiveId
      );

    if (
      activeStillExists &&
      savedActiveId
    ) {
      setActiveProductionId(
        savedActiveId
      );
    } else if (
      combinedProductions.length >
      0
    ) {
      const firstProductionId =
        combinedProductions[0].id;

      localStorage.setItem(
        "activeProductionId",
        firstProductionId
      );

      setActiveProductionId(
        firstProductionId
      );
    } else {
      localStorage.removeItem(
        "activeProductionId"
      );

      setActiveProductionId(
        null
      );
    }

    setLoading(false);
  }

  async function handleCreateProduction(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

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
      masterBudget <= 0 ||
      props < 0 ||
      stageManagement < 0 ||
      vat < 0
    ) {
      setMessage(
        "Please complete all required production details."
      );

      return;
    }

    setSaving(true);

    const {
      data,
      error,
    } = await supabase.rpc(
      "create_production_with_budgets",
      {
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

    const newProductionId =
      data as string;

    if (!newProductionId) {
      setMessage(
        "Production was created, but its ID could not be returned."
      );

      setSaving(false);
      return;
    }

    localStorage.setItem(
      "activeProductionId",
      newProductionId
    );

    setActiveProductionId(
      newProductionId
    );

    setProductionName("");
    setStageManager("");
    setAssistantStageManager("");

    setOriginalBudget(
      "12000"
    );

    setPropsBudget("");
    setStageManagementBudget("");

    setVatRate(
      "5"
    );

    setAllocationDate("");

    setMessage(
      "Production created successfully with Props and Stage Management allocations."
    );

    setSaving(false);

    await loadProductions();
  }

  function handleSelectProduction(
    productionId: string
  ) {
    localStorage.setItem(
      "activeProductionId",
      productionId
    );

    setActiveProductionId(
      productionId
    );

    /*
      Reload intentionally forces all
      active-production permissions and
      data to refresh.
    */
    window.location.reload();
  }

  async function handleDeleteProduction(
    production: Production
  ) {
    /*
      UI safeguard.

      Permanent deletion is reserved for
      the Owner of this specific production.
    */
    if (
      production.membership
        ?.access_level !==
      "Owner"
    ) {
      setMessage(
        "Only the production owner can delete this production."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${production.production_name}"?\n\nThis will permanently delete the production, its purchases, budget allocations and team membership data. This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      production.id
    );

    setMessage("");

    const {
      error,
    } = await supabase
      .from(
        "productions"
      )
      .delete()
      .eq(
        "id",
        production.id
      );

    if (error) {
      console.error(
        error
      );

      setMessage(
        error.message
      );

      setDeletingId(
        null
      );

      return;
    }

    const updatedProductions =
      productions.filter(
        (item) =>
          item.id !==
          production.id
      );

    setProductions(
      updatedProductions
    );

    const wasActive =
      activeProductionId ===
      production.id;

    if (wasActive) {
      if (
        updatedProductions.length >
        0
      ) {
        const nextProductionId =
          updatedProductions[0].id;

        localStorage.setItem(
          "activeProductionId",
          nextProductionId
        );

        setActiveProductionId(
          nextProductionId
        );
      } else {
        localStorage.removeItem(
          "activeProductionId"
        );

        setActiveProductionId(
          null
        );
      }
    }

    setDeletingId(
      null
    );

    setMessage(
      "Production deleted successfully."
    );
  }

  function formatMoney(
    value: number | null
  ) {
    if (
      value === null
    ) {
      return "Restricted";
    }

    return `AED ${value.toLocaleString(
      "en-AE",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  }

  const masterBudgetNumber =
    Number(
      originalBudget
    ) || 0;

  const propsBudgetNumber =
    Number(
      propsBudget
    ) || 0;

  const stageManagementBudgetNumber =
    Number(
      stageManagementBudget
    ) || 0;

  const allocatedTotal =
    propsBudgetNumber +
    stageManagementBudgetNumber;

  const unallocatedBudget =
    masterBudgetNumber -
    allocatedTotal;

  return (
    <main className="min-h-screen p-6 text-slate-900 md:p-10">

      <div className="mx-auto max-w-7xl">

        <div className="mb-8">

          <h1 className="text-3xl font-bold">
            Productions
          </h1>

          <p className="mt-2 text-slate-500">
            Create productions and switch between the productions you are part of.
          </p>

        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">

          {/* ==================================================
              CREATE PRODUCTION
          ================================================== */}

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="text-xl font-semibold">
              New Production
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Create a new production. You will become its Owner.
            </p>

            <form
              onSubmit={
                handleCreateProduction
              }
              className="mt-6 space-y-5"
            >

              <div>

                <label className="mb-2 block text-sm font-medium">
                  Production Name
                </label>

                <input
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
                  placeholder="Production name"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium">
                  Stage Manager
                </label>

                <input
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
                  placeholder="Stage Manager"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium">
                  Assistant Stage Manager
                </label>

                <input
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
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />

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
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />

              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">

                <p className="font-medium">
                  Default Allocations
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  These two budget allocations will be created automatically with the production.
                </p>

                <div className="mt-4 space-y-4">

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
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-500"
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
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-500"
                    />

                  </div>

                </div>

                <div className="mt-4 border-t border-slate-200 pt-4 text-sm">

                  <div className="flex justify-between gap-4">

                    <span className="text-slate-500">
                      Allocated
                    </span>

                    <span className="font-medium">
                      AED{" "}
                      {allocatedTotal.toFixed(
                        2
                      )}
                    </span>

                  </div>

                  <div className="mt-2 flex justify-between gap-4">

                    <span className="text-slate-500">
                      Unallocated
                    </span>

                    <span
                      className={`font-medium ${
                        unallocatedBudget <
                        0
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

                  {unallocatedBudget <
                    0 && (
                    <p className="mt-3 text-xs leading-5 text-red-600">
                      Your default allocations currently exceed the master budget.
                    </p>
                  )}

                </div>

              </div>

              <div className="grid gap-4 sm:grid-cols-2">

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
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
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
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                  />

                </div>

              </div>

              <button
                type="submit"
                disabled={
                  saving
                }
                className="w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create Production"}
              </button>

            </form>

          </div>

          {/* ==================================================
              PRODUCTION LIST
          ================================================== */}

          <div>

            <div className="mb-4 flex items-center justify-between">

              <div>

                <h2 className="text-xl font-semibold">
                  Your Productions
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your role and access can be different in each production.
                </p>

              </div>

              {!loading && (
                <span className="text-sm text-slate-500">
                  {
                    productions.length
                  }{" "}
                  {productions.length ===
                  1
                    ? "production"
                    : "productions"}
                </span>
              )}

            </div>

            {message && (
              <div className="mb-4 rounded-xl bg-slate-200 px-4 py-3 text-sm text-slate-700">
                {message}
              </div>
            )}

            {loading ? (

              <div className="rounded-2xl bg-white p-8 shadow-sm">

                <p className="text-slate-500">
                  Loading productions...
                </p>

              </div>

            ) : productions.length ===
              0 ? (

              <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

                <p className="text-lg font-medium">
                  No productions yet
                </p>

                <p className="mt-2 text-slate-500">
                  Create your first production using the form.
                </p>

              </div>

            ) : (

              <div className="grid gap-4">

                {productions.map(
                  (
                    production
                  ) => {
                    const isActive =
                      production.id ===
                      activeProductionId;

                    const isDeleting =
                      deletingId ===
                      production.id;

                    const isOwner =
                      production.membership
                        ?.access_level ===
                      "Owner";

                    return (
                      <div
                        key={
                          production.id
                        }
                        className={`rounded-2xl bg-white p-6 shadow-sm ${
                          isActive
                            ? "ring-2 ring-slate-900"
                            : ""
                        }`}
                      >

                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                          <div>

                            <div className="flex flex-wrap items-center gap-3">

                              <h3 className="text-xl font-semibold">
                                {
                                  production.production_name
                                }
                              </h3>

                              {isActive && (
                                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                                  Active
                                </span>
                              )}

                              {production.membership && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                  {
                                    production.membership.role
                                  }
                                  {" • "}
                                  {
                                    production.membership.access_level
                                  }
                                </span>
                              )}

                            </div>

                            <p className="mt-2 text-sm text-slate-500">
                              Stage Manager:{" "}
                              {
                                production.stage_manager
                              }
                            </p>

                            {production.assistant_stage_manager && (
                              <p className="mt-1 text-sm text-slate-500">
                                ASM:{" "}
                                {
                                  production.assistant_stage_manager
                                }
                              </p>
                            )}

                            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">

                              <span>

                                <span className="text-slate-500">
                                  Budget:{" "}
                                </span>

                                <span className="font-medium">
                                  {formatMoney(
                                    production.original_budget
                                  )}
                                </span>

                              </span>

                              <span>

                                <span className="text-slate-500">
                                  VAT:{" "}
                                </span>

                                <span className="font-medium">
                                  {
                                    production.vat_rate
                                  }
                                  %
                                </span>

                              </span>

                            </div>

                          </div>

                          <div className="flex flex-col gap-2 sm:min-w-[180px]">

                            {isActive ? (

                              <button
                                type="button"
                                disabled
                                className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-medium text-slate-500"
                              >
                                Current Production
                              </button>

                            ) : (

                              <button
                                type="button"
                                onClick={() =>
                                  handleSelectProduction(
                                    production.id
                                  )
                                }
                                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
                              >
                                Switch to Production
                              </button>

                            )}

                            {isOwner && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteProduction(
                                    production
                                  )
                                }
                                disabled={
                                  isDeleting
                                }
                                className="rounded-xl border border-red-200 px-5 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isDeleting
                                  ? "Deleting..."
                                  : "Delete Production"}
                              </button>
                            )}

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

      </div>

    </main>
  );
}