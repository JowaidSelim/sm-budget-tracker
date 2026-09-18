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
};

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [production, setProduction] =
    useState<Production | null>(null);

  const [productionName, setProductionName] = useState("");
  const [stageManager, setStageManager] = useState("");
  const [assistantStageManager, setAssistantStageManager] =
    useState("");
  const [originalBudget, setOriginalBudget] = useState("");
  const [vatRate, setVatRate] = useState("");
  const [allocationDate, setAllocationDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<"success" | "error" | "">("");

  useEffect(() => {
    loadProduction();
  }, []);

  async function loadProduction() {
    setLoading(true);
    setMessage("");
    setMessageType("");

    const activeProductionId =
      localStorage.getItem("activeProductionId");

    if (!activeProductionId) {
      setProduction(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("productions")
      .select(`
        id,
        production_name,
        stage_manager,
        assistant_stage_manager,
        original_budget,
        vat_rate,
        allocation_date
      `)
      .eq("id", activeProductionId)
      .single();

    if (error || !data) {
      console.error(error);

      setMessage(
        "Could not load the active production."
      );
      setMessageType("error");
      setProduction(null);
      setLoading(false);
      return;
    }

    const productionData =
      data as Production;

    setProduction(productionData);

    setProductionName(
      productionData.production_name
    );

    setStageManager(
      productionData.stage_manager
    );

    setAssistantStageManager(
      productionData.assistant_stage_manager ?? ""
    );

    setOriginalBudget(
      Number(
        productionData.original_budget
      ).toString()
    );

    setVatRate(
      Number(
        productionData.vat_rate
      ).toString()
    );

    setAllocationDate(
      productionData.allocation_date ?? ""
    );

    setLoading(false);
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!production) {
      setMessage(
        "No active production selected."
      );
      setMessageType("error");
      return;
    }

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
      setMessageType("error");
      return;
    }

    setSaving(true);
    setMessage("");
    setMessageType("");

    const { data, error } = await supabase
      .from("productions")
      .update({
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
      .eq("id", production.id)
      .select(`
        id,
        production_name,
        stage_manager,
        assistant_stage_manager,
        original_budget,
        vat_rate,
        allocation_date
      `)
      .single();

    if (error || !data) {
      console.error(error);

      setMessage(
        error?.message ||
          "Could not save production settings."
      );

      setMessageType("error");
      setSaving(false);
      return;
    }

    setProduction(
      data as Production
    );

    setMessage(
      "Production settings saved successfully."
    );

    setMessageType("success");
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="p-6 text-slate-900 md:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-slate-500">
              Loading production settings...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!production) {
    return (
      <main className="p-6 text-slate-900 md:p-10">
        <div className="mx-auto max-w-4xl">

          <div className="mb-8">
            <h1 className="text-3xl font-bold">
              Settings
            </h1>

            <p className="mt-2 text-slate-500">
              Production and budget settings
            </p>
          </div>

          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-medium">
              No active production
            </p>

            <p className="mt-2 text-slate-500">
              Select or create a production before editing settings.
            </p>

            <button
              type="button"
              onClick={() =>
                (window.location.href =
                  "/productions")
              }
              className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800"
            >
              Go to Productions
            </button>
          </div>

        </div>
      </main>
    );
  }

  return (
    <main className="p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-4xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Settings
          </h1>

          <p className="mt-2 text-slate-500">
            Edit settings for{" "}
            <span className="font-medium text-slate-700">
              {production.production_name}
            </span>
          </p>
        </div>

        <form
          onSubmit={handleSave}
          className="rounded-2xl bg-white p-6 shadow-sm md:p-8"
        >
          <div className="grid gap-6 md:grid-cols-2">

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                Production Name
              </label>

              <input
                value={productionName}
                onChange={(e) =>
                  setProductionName(
                    e.target.value
                  )
                }
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Stage Manager
              </label>

              <input
                value={stageManager}
                onChange={(e) =>
                  setStageManager(
                    e.target.value
                  )
                }
                required
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

            <div>
              <label className="mb-2 block text-sm font-medium">
                Original Budget
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={originalBudget}
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
                VAT Rate %
              </label>

              <input
                type="number"
                min="0"
                step="0.1"
                value={vatRate}
                onChange={(e) =>
                  setVatRate(
                    e.target.value
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
                value={allocationDate}
                onChange={(e) =>
                  setAllocationDate(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>

          </div>

          {message && (
            <div
              className={`mt-6 rounded-xl px-4 py-3 text-sm ${
                messageType === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Settings"}
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}