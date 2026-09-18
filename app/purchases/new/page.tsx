"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Production = {
  id: string;
  production_name: string;
  vat_rate: number;
};

export default function NewPurchasePage() {
  const supabase = useMemo(() => createClient(), []);

  const [production, setProduction] =
    useState<Production | null>(null);

  const [receipt, setReceipt] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Props");
  const [item, setItem] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState("Petty Cash");
  const [supplier, setSupplier] = useState("");
  const [totalInclVat, setTotalInclVat] = useState("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProduction();
  }, []);

  async function loadProduction() {
    const activeProductionId =
      localStorage.getItem("activeProductionId");

    if (!activeProductionId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("productions")
      .select("id, production_name, vat_rate")
      .eq("id", activeProductionId)
      .single();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setProduction(data as Production);
    setLoading(false);
  }

  const total = Number(totalInclVat) || 0;

  const vatRate =
    Number(production?.vat_rate ?? 5);

  const vatMultiplier =
    1 + vatRate / 100;

  const beforeVat =
    vatMultiplier > 0
      ? total / vatMultiplier
      : total;

  const vat =
    total - beforeVat;

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!production) {
      setMessage("No active production selected.");
      return;
    }

    if (
      !receipt.trim() ||
      !date ||
      !item.trim() ||
      !supplier.trim() ||
      total <= 0
    ) {
      setMessage("Please complete all required fields.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("purchases")
      .insert({
        production_id: production.id,
        receipt: receipt.trim(),
        purchase_date: date,
        category,
        item: item.trim(),
        payment_method: paymentMethod,
        supplier: supplier.trim(),
        total_including_vat: total,
      });

    if (error) {
      console.error(error);
      setMessage(error.message);
      setSaving(false);
      return;
    }

    window.location.href = "/purchases";
  }

  if (loading) {
    return (
      <main className="p-6 md:p-10">
        <p>Loading...</p>
      </main>
    );
  }

  if (!production) {
    return (
      <main className="p-6 md:p-10">
        <p>No active production selected.</p>
      </main>
    );
  }

  return (
    <main className="p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-3xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Add Purchase
          </h1>

          <p className="mt-2 text-slate-500">
            {production.production_name}
          </p>
        </div>

        <form
          onSubmit={handleSave}
          className="rounded-2xl bg-white p-6 shadow-sm md:p-8"
        >

          <div className="grid gap-6 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-medium">
                Receipt / Invoice No.
              </label>

              <input
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Date
              </label>

              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Category
              </label>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option>Props</option>
                <option>Stage Management</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Payment Method
              </label>

              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option>Petty Cash</option>
                <option>Credit Card</option>
                <option>Purchase Order</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                Item
              </label>

              <input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Supplier
              </label>

              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Total Incl. VAT
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={totalInclVat}
                onChange={(e) =>
                  setTotalInclVat(e.target.value)
                }
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

          </div>

          <div className="mt-8 grid gap-4 rounded-2xl bg-slate-100 p-5 md:grid-cols-3">

            <div>
              <p className="text-sm text-slate-500">
                Before VAT
              </p>
              <p className="mt-1 text-xl font-semibold">
                AED {beforeVat.toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                VAT ({vatRate}%)
              </p>
              <p className="mt-1 text-xl font-semibold">
                AED {vat.toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Total
              </p>
              <p className="mt-1 text-xl font-semibold">
                AED {total.toFixed(2)}
              </p>
            </div>

          </div>

          {message && (
            <p className="mt-5 text-sm text-red-600">
              {message}
            </p>
          )}

          <div className="mt-8 flex justify-end gap-3">

            <button
              type="button"
              onClick={() =>
                (window.location.href = "/purchases")
              }
              className="rounded-xl border border-slate-300 px-5 py-3 font-medium"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Purchase"}
            </button>

          </div>

        </form>
      </div>
    </main>
  );
}