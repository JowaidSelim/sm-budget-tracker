"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type PurchaseCategory =
  | "Props"
  | "Stage Management";

type Production = {
  id: string;
  production_name: string;
  vat_rate: number;
};

type Membership = {
  can_edit_props: boolean;
  can_edit_stage_management: boolean;
};

type Allocation = {
  id: string;
  production_id: string;
  name: string;
  category: PurchaseCategory;
  allocated_amount: number;
  assigned_user_id: string | null;
};

export default function NewPurchasePage() {
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
    membership,
    setMembership,
  ] = useState<Membership | null>(
    null
  );

  const [
    allocations,
    setAllocations,
  ] = useState<Allocation[]>([]);

  const [
    allocationId,
    setAllocationId,
  ] = useState("");

  const [
    receipt,
    setReceipt,
  ] = useState("");

  const [
    date,
    setDate,
  ] = useState("");

  const [
    item,
    setItem,
  ] = useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState(
    "Petty Cash"
  );

  const [
    supplier,
    setSupplier,
  ] = useState("");

  const [
    totalInclVat,
    setTotalInclVat,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    const activeProductionId =
      localStorage.getItem(
        "activeProductionId"
      );

    if (!activeProductionId) {
      setLoading(false);
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
      setMessage(
        "Could not identify the signed-in user."
      );

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
        vat_rate
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

    const {
      data: membershipData,
      error: membershipError,
    } = await supabase
      .from(
        "production_members"
      )
      .select(`
        can_edit_props,
        can_edit_stage_management
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

    if (
      membershipError ||
      !membershipData
    ) {
      console.error(
        membershipError
      );

      setMessage(
        "Could not load your purchase permissions."
      );

      setLoading(false);
      return;
    }

    const currentMembership =
      membershipData as Membership;

    setMembership(
      currentMembership
    );

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
        "Could not load budget allocations."
      );

      setLoading(false);
      return;
    }

    const visibleAllocations =
      (allocationData as Allocation[]) ??
      [];

    const permittedAllocations =
      visibleAllocations.filter(
        (allocation) => {
          if (
            allocation.category ===
            "Props"
          ) {
            return currentMembership.can_edit_props;
          }

          if (
            allocation.category ===
            "Stage Management"
          ) {
            return currentMembership.can_edit_stage_management;
          }

          return false;
        }
      );

    setAllocations(
      permittedAllocations
    );

    setLoading(false);
  }

  const selectedAllocation =
    allocations.find(
      (allocation) =>
        allocation.id ===
        allocationId
    ) ?? null;

  const total =
    Number(
      totalInclVat
    ) || 0;

  const vatRate =
    Number(
      production?.vat_rate ??
        5
    );

  const vatMultiplier =
    1 +
    vatRate /
      100;

  const beforeVat =
    vatMultiplier >
    0
      ? total /
        vatMultiplier
      : total;

  const vat =
    total -
    beforeVat;

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!production) {
      setMessage(
        "No active production selected."
      );

      return;
    }

    if (
      !receipt.trim() ||
      !date ||
      !item.trim() ||
      !supplier.trim() ||
      total <= 0
    ) {
      setMessage(
        "Please complete all required fields."
      );

      return;
    }

    if (
      !selectedAllocation
    ) {
      setMessage(
        "Select a budget allocation for this purchase."
      );

      return;
    }

    setSaving(true);
    setMessage("");

    const {
      error,
    } = await supabase
      .from("purchases")
      .insert({
        production_id:
          production.id,

        allocation_id:
          selectedAllocation.id,

        category:
          selectedAllocation.category,

        receipt:
          receipt.trim(),

        purchase_date:
          date,

        item:
          item.trim(),

        payment_method:
          paymentMethod,

        supplier:
          supplier.trim(),

        total_including_vat:
          total,
      });

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

    window.location.href =
      "/purchases";
  }

  if (loading) {
    return (
      <main className="p-6 md:p-10">
        <p>
          Loading...
        </p>
      </main>
    );
  }

  if (!production) {
    return (
      <main className="p-6 md:p-10">
        <p>
          No active production selected.
        </p>
      </main>
    );
  }

  if (!membership) {
    return (
      <main className="p-6 text-slate-900 md:p-10">
        <div className="mx-auto max-w-3xl">

          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

            <p className="text-lg font-semibold">
              Purchase entry unavailable
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Your production permissions could not be loaded.
            </p>

          </div>

        </div>
      </main>
    );
  }

  if (
    allocations.length ===
    0
  ) {
    return (
      <main className="p-6 text-slate-900 md:p-10">
        <div className="mx-auto max-w-3xl">

          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

            <p className="text-lg font-semibold">
              No available budget allocation
            </p>

            <p className="mt-2 text-sm text-slate-500">
              You need an allocation you have permission to use before creating a purchase.
            </p>

          </div>

        </div>
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
            {
              production.production_name
            }
          </p>

        </div>

        <form
          onSubmit={
            handleSave
          }
          className="rounded-2xl bg-white p-6 shadow-sm md:p-8"
        >

          <div className="grid gap-6 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-medium">
                Receipt / Invoice No.
              </label>

              <input
                value={
                  receipt
                }
                onChange={(event) =>
                  setReceipt(
                    event.target.value
                  )
                }
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
                value={
                  date
                }
                onChange={(event) =>
                  setDate(
                    event.target.value
                  )
                }
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div className="md:col-span-2">

              <label className="mb-2 block text-sm font-medium">
                Budget Allocation
              </label>

              <select
                value={
                  allocationId
                }
                onChange={(event) =>
                  setAllocationId(
                    event.target.value
                  )
                }
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">
                  Select an allocation
                </option>

                {allocations.map(
                  (
                    allocation
                  ) => (
                    <option
                      key={
                        allocation.id
                      }
                      value={
                        allocation.id
                      }
                    >
                      {allocation.name}
                      {" — "}
                      {allocation.category}
                      {" — AED "}
                      {Number(
                        allocation.allocated_amount
                      ).toLocaleString(
                        "en-AE",
                        {
                          minimumFractionDigits:
                            2,
                          maximumFractionDigits:
                            2,
                        }
                      )}
                    </option>
                  )
                )}
              </select>

              {selectedAllocation && (
                <p className="mt-2 text-xs text-slate-500">
                  Category:{" "}
                  <span className="font-medium text-slate-700">
                    {
                      selectedAllocation.category
                    }
                  </span>
                  . The purchase category will be assigned automatically.
                </p>
              )}

            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Payment Method
              </label>

              <select
                value={
                  paymentMethod
                }
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option>
                  Petty Cash
                </option>

                <option>
                  Credit Card
                </option>

                <option>
                  Purchase Order
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Supplier
              </label>

              <input
                value={
                  supplier
                }
                onChange={(event) =>
                  setSupplier(
                    event.target.value
                  )
                }
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                Item
              </label>

              <input
                value={
                  item
                }
                onChange={(event) =>
                  setItem(
                    event.target.value
                  )
                }
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                Total Incl. VAT
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  totalInclVat
                }
                onChange={(event) =>
                  setTotalInclVat(
                    event.target.value
                  )
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
                AED{" "}
                {beforeVat.toFixed(
                  2
                )}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                VAT ({vatRate}%)
              </p>

              <p className="mt-1 text-xl font-semibold">
                AED{" "}
                {vat.toFixed(
                  2
                )}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Total
              </p>

              <p className="mt-1 text-xl font-semibold">
                AED{" "}
                {total.toFixed(
                  2
                )}
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
                (
                  window.location.href =
                    "/purchases"
                )
              }
              className="rounded-xl border border-slate-300 px-5 py-3 font-medium"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                !selectedAllocation
              }
              className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Purchase"}
            </button>

          </div>

        </form>

      </div>
    </main>
  );
}