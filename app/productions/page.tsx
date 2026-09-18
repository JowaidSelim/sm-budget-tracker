"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Production = {
  id: string;
  production_name: string;
  stage_manager: string;
  assistant_stage_manager: string | null;
  original_budget: number;
  vat_rate: number;
  allocation_date: string | null;
  created_at: string;
};

export default function ProductionsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [productions, setProductions] = useState<Production[]>([]);
  const [activeProductionId, setActiveProductionId] =
    useState<string | null>(null);

  const [productionName, setProductionName] = useState("");
  const [stageManager, setStageManager] = useState("");
  const [assistantStageManager, setAssistantStageManager] =
    useState("");
  const [originalBudget, setOriginalBudget] = useState("12000");
  const [vatRate, setVatRate] = useState("5");
  const [allocationDate, setAllocationDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProductions();
  }, []);

  async function loadProductions() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("productions")
      .select(`
        id,
        production_name,
        stage_manager,
        assistant_stage_manager,
        original_budget,
        vat_rate,
        allocation_date,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const productionData =
      (data as Production[]) ?? [];

    setProductions(productionData);

    const savedActiveId =
      localStorage.getItem("activeProductionId");

    const activeStillExists =
      savedActiveId &&
      productionData.some(
        (production) =>
          production.id === savedActiveId
      );

    if (activeStillExists && savedActiveId) {
      setActiveProductionId(savedActiveId);
    } else if (productionData.length > 0) {
      const firstProductionId =
        productionData[0].id;

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

      setActiveProductionId(null);
    }

    setLoading(false);
  }

  async function handleCreateProduction(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    const budget =
      Number(originalBudget);

    const vat =
      Number(vatRate);

    if (
      !productionName.trim() ||
      !stageManager.trim() ||
      budget <= 0 ||
      vat < 0
    ) {
      setMessage(
        "Please complete all required production details."
      );

      return;
    }

    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage(
        "Could not identify the signed-in user."
      );

      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("productions")
      .insert({
        owner_id: user.id,

        production_name:
          productionName.trim(),

        stage_manager:
          stageManager.trim(),

        assistant_stage_manager:
          assistantStageManager.trim() ||
          null,

        original_budget:
          budget,

        vat_rate:
          vat,

        allocation_date:
          allocationDate || null,
      })
      .select()
      .single();

    if (error) {
      console.error(error);

      setMessage(
        error.message
      );

      setSaving(false);
      return;
    }

    localStorage.setItem(
      "activeProductionId",
      data.id
    );

    setActiveProductionId(
      data.id
    );

    setProductionName("");
    setStageManager("");
    setAssistantStageManager("");
    setOriginalBudget("12000");
    setVatRate("5");
    setAllocationDate("");

    setMessage(
      "Production created successfully."
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

    window.location.reload();
  }

  async function handleDeleteProduction(
    production: Production
  ) {
    const confirmed =
      window.confirm(
        `Delete "${production.production_name}"?\n\nThis will permanently delete the production and all purchases connected to it. This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      production.id
    );

    setMessage("");

    const { error } = await supabase
      .from("productions")
      .delete()
      .eq("id", production.id);

    if (error) {
      console.error(error);

      setMessage(
        error.message
      );

      setDeletingId(null);
      return;
    }

    const updatedProductions =
      productions.filter(
        (item) =>
          item.id !== production.id
      );

    setProductions(
      updatedProductions
    );

    const wasActive =
      activeProductionId ===
      production.id;

    if (wasActive) {
      if (
        updatedProductions.length > 0
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

    setDeletingId(null);

    setMessage(
      "Production deleted successfully."
    );
  }

  return (
    <main className="min-h-screen p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Productions
          </h1>

          <p className="mt-2 text-slate-500">
            Create, switch and manage productions
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="text-xl font-semibold">
              New Production
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Create a new production budget.
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
                  onChange={(e) =>
                    setProductionName(
                      e.target.value
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
                  onChange={(e) =>
                    setStageManager(
                      e.target.value
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
                  onChange={(e) =>
                    setAssistantStageManager(
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Budget
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      originalBudget
                    }
                    onChange={(e) =>
                      setOriginalBudget(
                        e.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>

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
                    onChange={(e) =>
                      setVatRate(
                        e.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>

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
                  onChange={(e) =>
                    setAllocationDate(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
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

          <div>

            <div className="mb-4 flex items-center justify-between">

              <div>
                <h2 className="text-xl font-semibold">
                  Your Productions
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Choose which production you want to work on.
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
                                  AED{" "}
                                  {Number(
                                    production.original_budget
                                  ).toLocaleString(
                                    "en-AE",
                                    {
                                      minimumFractionDigits:
                                        2,
                                      maximumFractionDigits:
                                        2,
                                    }
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