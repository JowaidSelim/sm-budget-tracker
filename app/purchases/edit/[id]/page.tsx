"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PurchaseCategory =
  | "Props"
  | "Stage Management";

type Purchase = {
  id: string;
  production_id: string;
  allocation_id: string | null;
  receipt: string;
  purchase_date: string;
  category: PurchaseCategory;
  item: string;
  payment_method: string;
  supplier: string;
  total_including_vat: number;

  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
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

type Profile = {
  user_id: string;
  username: string;
  display_name: string | null;
};

type AuditPerson = {
  username: string;
  display_name: string | null;
};

export default function EditPurchasePage() {
  const params = useParams();
  const id = params.id as string;

  const supabase = useMemo(
    () => createClient(),
    []
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
    originalCategory,
    setOriginalCategory,
  ] = useState<PurchaseCategory>(
    "Props"
  );

  const [
    allocationId,
    setAllocationId,
  ] = useState("");

  const [
    wasHistoricallyUnallocated,
    setWasHistoricallyUnallocated,
  ] = useState(false);

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
    vatRate,
    setVatRate,
  ] = useState(5);

  /*
    ======================================================
    AUDIT TRAIL
    ======================================================
  */

  const [
    createdAt,
    setCreatedAt,
  ] = useState<string | null>(
    null
  );

  const [
    updatedAt,
    setUpdatedAt,
  ] = useState<string | null>(
    null
  );

  const [
    createdBy,
    setCreatedBy,
  ] = useState<AuditPerson | null>(
    null
  );

  const [
    updatedBy,
    setUpdatedBy,
  ] = useState<AuditPerson | null>(
    null
  );

  const [
    hasKnownCreator,
    setHasKnownCreator,
  ] = useState(false);

  const [
    hasKnownUpdater,
    setHasKnownUpdater,
  ] = useState(false);

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

  useEffect(() => {
    loadPurchase();
  }, [id]);

  async function loadPurchase() {
    setLoading(true);
    setMessage("");

    const activeProductionId =
      localStorage.getItem(
        "activeProductionId"
      );

    if (!activeProductionId) {
      setMessage(
        "No active production selected."
      );

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

    /*
      ======================================================
      PRODUCTION VAT
      ======================================================
    */

    const {
      data: productionData,
      error: productionError,
    } = await supabase
      .from("productions")
      .select("vat_rate")
      .eq(
        "id",
        activeProductionId
      )
      .single();

    if (productionError) {
      console.error(
        productionError
      );
    }

    if (productionData) {
      setVatRate(
        Number(
          productionData.vat_rate
        )
      );
    }

    /*
      ======================================================
      CURRENT USER PERMISSIONS
      ======================================================
    */

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

    /*
      ======================================================
      AVAILABLE ALLOCATIONS
      ======================================================

      SQL 22 now makes category permissions
      the working boundary.

      Multiple ASMs with Props edit access
      therefore see the same Props allocations.
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

    /*
      ======================================================
      PURCHASE + AUDIT DATA
      ======================================================
    */

    const {
      data,
      error,
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
        total_including_vat,
        created_at,
        created_by,
        updated_at,
        updated_by
      `)
      .eq(
        "id",
        id
      )
      .eq(
        "production_id",
        activeProductionId
      )
      .single();

    if (
      error ||
      !data
    ) {
      console.error(
        error
      );

      setMessage(
        "Purchase not found or you do not have permission to edit it."
      );

      setLoading(false);
      return;
    }

    const purchase =
      data as Purchase;

    /*
      Verify edit permission for the
      purchase's existing category.

      This protects the edit screen itself,
      not only the Save button.
    */
    const canEditCurrentPurchase =
      purchase.category ===
      "Props"
        ? currentMembership.can_edit_props
        : purchase.category ===
            "Stage Management"
          ? currentMembership.can_edit_stage_management
          : false;

    if (!canEditCurrentPurchase) {
      setMessage(
        "You do not have permission to edit this purchase."
      );

      setLoading(false);
      return;
    }

    setReceipt(
      purchase.receipt
    );

    setDate(
      purchase.purchase_date
    );

    setOriginalCategory(
      purchase.category
    );

    setAllocationId(
      purchase.allocation_id ??
        ""
    );

    setWasHistoricallyUnallocated(
      purchase.allocation_id ===
        null
    );

    setItem(
      purchase.item
    );

    setPaymentMethod(
      purchase.payment_method
    );

    setSupplier(
      purchase.supplier
    );

    setTotalInclVat(
      Number(
        purchase.total_including_vat
      ).toString()
    );

    /*
      Store audit timestamps.
    */
    setCreatedAt(
      purchase.created_at
    );

    setUpdatedAt(
      purchase.updated_at
    );

    setHasKnownCreator(
      !!purchase.created_by
    );

    setHasKnownUpdater(
      !!purchase.updated_by
    );

    /*
      Fetch public profile details for
      whoever created / last edited the
      purchase.

      Email is never requested or exposed.
    */
    const auditUserIds =
      Array.from(
        new Set(
          [
            purchase.created_by,
            purchase.updated_by,
          ].filter(
            Boolean
          ) as string[]
        )
      );

    if (
      auditUserIds.length >
      0
    ) {
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          user_id,
          username,
          display_name
        `)
        .in(
          "user_id",
          auditUserIds
        );

      if (profileError) {
        console.error(
          profileError
        );
      } else {
        const profiles =
          (profileData as Profile[]) ??
          [];

        const profileMap =
          new Map(
            profiles.map(
              (profile) => [
                profile.user_id,
                profile,
              ]
            )
          );

        if (
          purchase.created_by
        ) {
          const creator =
            profileMap.get(
              purchase.created_by
            );

          if (creator) {
            setCreatedBy({
              username:
                creator.username,

              display_name:
                creator.display_name,
            });
          }
        }

        if (
          purchase.updated_by
        ) {
          const updater =
            profileMap.get(
              purchase.updated_by
            );

          if (updater) {
            setUpdatedBy({
              username:
                updater.username,

              display_name:
                updater.display_name,
            });
          }
        }
      }
    }

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

  /*
    ======================================================
    FORMATTING
    ======================================================
  */

  function formatAuditDate(
    value: string | null
  ) {
    if (!value) {
      return "Unknown";
    }

    const parsed =
      new Date(value);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return "Unknown";
    }

    return parsed.toLocaleString(
      "en-AE",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  function personLabel(
    person: AuditPerson | null,
    knownUserId: boolean
  ) {
    /*
      Historical purchases created before
      audit tracking have no user ID.
    */
    if (!knownUserId) {
      return "Unknown / historical";
    }

    /*
      A user ID exists, but their public
      profile could not be resolved.
    */
    if (!person) {
      return "Unknown user";
    }

    if (
      person.display_name
    ) {
      return `${person.display_name} (@${person.username})`;
    }

    return `@${person.username}`;
  }

  /*
    ======================================================
    SAVE
    ======================================================
  */

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

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

    /*
      Historical purchases are allowed
      to remain unallocated.

      Once an allocation is chosen,
      its category automatically becomes
      the purchase category.
    */
    const finalCategory =
      selectedAllocation
        ? selectedAllocation.category
        : originalCategory;

    if (
      finalCategory ===
        "Props" &&
      !membership?.can_edit_props
    ) {
      setMessage(
        "You do not have permission to edit Props purchases."
      );

      return;
    }

    if (
      finalCategory ===
        "Stage Management" &&
      !membership?.can_edit_stage_management
    ) {
      setMessage(
        "You do not have permission to edit Stage Management purchases."
      );

      return;
    }

    /*
      A modern purchase must retain an
      allocation.

      Only purchases that were already
      historical/unallocated may remain
      without one.
    */
    if (
      !wasHistoricallyUnallocated &&
      !selectedAllocation
    ) {
      setMessage(
        "Please select a budget allocation."
      );

      return;
    }

    setSaving(true);
    setMessage("");

    /*
      Do NOT send created_by, updated_by
      or updated_at from the browser.

      The SQL 22 database trigger records
      the authenticated user automatically.
    */
    const {
      error,
    } = await supabase
      .from("purchases")
      .update({
        allocation_id:
          selectedAllocation
            ? selectedAllocation.id
            : null,

        category:
          finalCategory,

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
      })
      .eq(
        "id",
        id
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

    window.location.href =
      "/purchases";
  }

  /*
    ======================================================
    PAGE STATES
    ======================================================
  */

  if (loading) {
    return (
      <main className="p-6 md:p-10">

        <p>
          Loading purchase...
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
              Purchase editing unavailable
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Your production permissions could not be loaded.
            </p>

          </div>

        </div>

      </main>
    );
  }

  /*
    If we have membership but failed later
    because this purchase is not editable,
    show a clean state instead of an empty form.
  */
  if (
    message ===
    "You do not have permission to edit this purchase." ||
    message ===
    "Purchase not found or you do not have permission to edit it."
  ) {
    return (
      <main className="p-6 text-slate-900 md:p-10">

        <div className="mx-auto max-w-3xl">

          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

            <p className="text-lg font-semibold">
              Purchase editing unavailable
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {message}
            </p>

            <button
              type="button"
              onClick={() =>
                (
                  window.location.href =
                    "/purchases"
                )
              }
              className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white"
            >
              Back to Purchases
            </button>

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
            Edit Purchase
          </h1>

          <p className="mt-2 text-slate-500">
            Update purchase information and budget allocation.
          </p>

        </div>

        <form
          onSubmit={
            handleSave
          }
          className="rounded-2xl bg-white p-6 shadow-sm md:p-8"
        >

          <div className="grid gap-6 md:grid-cols-2">

            {/* RECEIPT */}

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

            {/* DATE */}

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

            {/* ALLOCATION */}

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
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >

                {wasHistoricallyUnallocated && (
                  <option value="">
                    Historical unallocated purchase
                  </option>
                )}

                {!wasHistoricallyUnallocated &&
                  !allocationId && (
                    <option value="">
                      Select an allocation
                    </option>
                  )}

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

                  . The purchase category is set automatically from this allocation.

                </p>
              )}

              {wasHistoricallyUnallocated &&
                !selectedAllocation && (
                  <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3">

                    <p className="text-sm font-medium text-amber-800">
                      Historical unallocated purchase
                    </p>

                    <p className="mt-1 text-xs leading-5 text-amber-700">
                      This purchase was created before budget allocations were introduced. You can leave it unallocated or assign it to an allocation now.
                    </p>

                    <p className="mt-2 text-xs text-amber-700">

                      Existing category:{" "}

                      <span className="font-medium">
                        {
                          originalCategory
                        }
                      </span>

                    </p>

                  </div>
                )}

            </div>

            {/* PAYMENT METHOD */}

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

            {/* SUPPLIER */}

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

            {/* ITEM */}

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

            {/* TOTAL */}

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

          {/* VAT SUMMARY */}

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

          {/* ==================================================
              AUDIT TRAIL
          ================================================== */}

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">

            <div>

              <h2 className="font-semibold">
                Activity
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Shows who created this purchase and who most recently changed it.
              </p>

            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">

              {/* CREATED */}

              <div>

                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Created by
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {personLabel(
                    createdBy,
                    hasKnownCreator
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {formatAuditDate(
                    createdAt
                  )}
                </p>

              </div>

              {/* UPDATED */}

              <div>

                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Last edited by
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {personLabel(
                    updatedBy,
                    hasKnownUpdater
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {formatAuditDate(
                    updatedAt
                  )}
                </p>

              </div>

            </div>

            {!hasKnownCreator && (
              <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                This purchase predates user audit tracking, so its original creator cannot be identified reliably.
              </p>
            )}

          </div>

          {/* MESSAGE */}

          {message && (
            <p className="mt-5 text-sm text-red-600">
              {message}
            </p>
          )}

          {/* ACTIONS */}

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
                saving
              }
              className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50"
            >

              {saving
                ? "Saving..."
                : "Save Changes"}

            </button>

          </div>

        </form>

      </div>

    </main>
  );
}