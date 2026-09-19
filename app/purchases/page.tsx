"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
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

  created_by: string | null;
  updated_by: string | null;
};

type Allocation = {
  id: string;
  name: string;
  category: PurchaseCategory;
};

type Production = {
  id: string;
  production_name: string;
  vat_rate: number;
};

type Membership = {
  can_edit_props: boolean;
  can_edit_stage_management: boolean;
};

type Profile = {
  user_id: string;
  username: string;
  display_name: string | null;
};

export default function PurchasesPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [
    purchases,
    setPurchases,
  ] = useState<Purchase[]>([]);

  const [
    allocations,
    setAllocations,
  ] = useState<Allocation[]>([]);

  const [
    profiles,
    setProfiles,
  ] = useState<
    Map<string, Profile>
  >(
    new Map()
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
    search,
    setSearch,
  ] = useState("");

  const [
    allocationFilter,
    setAllocationFilter,
  ] = useState("All");

  const [
    paymentFilter,
    setPaymentFilter,
  ] = useState("All");

  const [
    sortBy,
    setSortBy,
  ] = useState(
    "date-newest"
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const activeProductionId =
      localStorage.getItem(
        "activeProductionId"
      );

    if (!activeProductionId) {
      setProduction(null);
      setPurchases([]);
      setAllocations([]);
      setProfiles(
        new Map()
      );
      setMembership(null);
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
      PRODUCTION
      ======================================================
    */

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

    if (productionError) {
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

    if (membershipError) {
      console.error(
        membershipError
      );

      setMessage(
        "Could not load your purchase permissions."
      );

      setLoading(false);
      return;
    }

    setMembership(
      membershipData as Membership | null
    );

    /*
      ======================================================
      ALLOCATIONS
      ======================================================
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
        name,
        category
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
    }

    setAllocations(
      (allocationData as Allocation[]) ??
        []
    );

    /*
      ======================================================
      PURCHASES + AUDIT IDS
      ======================================================
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
        total_including_vat,
        created_by,
        updated_by
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
        "Could not load purchases."
      );

      setPurchases([]);
      setProfiles(
        new Map()
      );
      setLoading(false);
      return;
    }

    const loadedPurchases =
      (purchaseData as Purchase[]) ??
      [];

    setPurchases(
      loadedPurchases
    );

    /*
      ======================================================
      AUDIT USER PROFILES
      ======================================================

      We only need public username/display_name.
      Email is never requested.
    */

    const auditUserIds =
      Array.from(
        new Set(
          loadedPurchases
            .flatMap(
              (purchase) => [
                purchase.created_by,
                purchase.updated_by,
              ]
            )
            .filter(
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
        const profileRows =
          (profileData as Profile[]) ??
          [];

        setProfiles(
          new Map(
            profileRows.map(
              (profile) => [
                profile.user_id,
                profile,
              ]
            )
          )
        );
      }
    } else {
      setProfiles(
        new Map()
      );
    }

    setLoading(false);
  }

  /*
    ======================================================
    PERMISSIONS
    ======================================================
  */

  function canEditPurchase(
    purchase: Purchase
  ) {
    if (!membership) {
      return false;
    }

    if (
      purchase.category ===
      "Props"
    ) {
      return membership.can_edit_props;
    }

    if (
      purchase.category ===
      "Stage Management"
    ) {
      return membership.can_edit_stage_management;
    }

    return false;
  }

  const canAddPurchase =
    !!membership &&
    (
      membership.can_edit_props ||
      membership.can_edit_stage_management
    );

  /*
    ======================================================
    DELETE
    ======================================================
  */

  async function handleDelete(
    purchase: Purchase
  ) {
    if (
      !canEditPurchase(
        purchase
      )
    ) {
      alert(
        "You do not have permission to delete this purchase."
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this purchase?"
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("purchases")
      .delete()
      .eq(
        "id",
        purchase.id
      );

    if (error) {
      alert(
        error.message
      );

      return;
    }

    setPurchases(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            purchase.id
        )
    );
  }

  /*
    ======================================================
    HELPERS
    ======================================================
  */

  function formatDate(
    date: string
  ) {
    if (!date) {
      return "";
    }

    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  function allocationName(
    allocationId: string | null
  ) {
    if (!allocationId) {
      return "Historical / Unallocated";
    }

    const allocation =
      allocations.find(
        (item) =>
          item.id ===
          allocationId
      );

    return (
      allocation?.name ??
      "Unknown allocation"
    );
  }

  function auditName(
    userId: string | null
  ) {
    if (!userId) {
      return "Historical";
    }

    const profile =
      profiles.get(
        userId
      );

    if (!profile) {
      return "Unknown user";
    }

    return `@${profile.username}`;
  }

  /*
    ======================================================
    FILTERING / SORTING
    ======================================================
  */

  const filteredPurchases =
    useMemo(() => {
      let result =
        [...purchases];

      const searchTerm =
        search
          .trim()
          .toLowerCase();

      if (searchTerm) {
        result =
          result.filter(
            (purchase) => {
              const allocation =
                allocationName(
                  purchase.allocation_id
                ).toLowerCase();

              const creator =
                auditName(
                  purchase.created_by
                ).toLowerCase();

              const updater =
                auditName(
                  purchase.updated_by
                ).toLowerCase();

              return (
                purchase.receipt
                  .toLowerCase()
                  .includes(
                    searchTerm
                  ) ||
                purchase.item
                  .toLowerCase()
                  .includes(
                    searchTerm
                  ) ||
                purchase.supplier
                  .toLowerCase()
                  .includes(
                    searchTerm
                  ) ||
                allocation.includes(
                  searchTerm
                ) ||
                creator.includes(
                  searchTerm
                ) ||
                updater.includes(
                  searchTerm
                )
              );
            }
          );
      }

      if (
        allocationFilter !==
        "All"
      ) {
        if (
          allocationFilter ===
          "Unallocated"
        ) {
          result =
            result.filter(
              (purchase) =>
                !purchase.allocation_id
            );
        } else {
          result =
            result.filter(
              (purchase) =>
                purchase.allocation_id ===
                allocationFilter
            );
        }
      }

      if (
        paymentFilter !==
        "All"
      ) {
        result =
          result.filter(
            (purchase) =>
              purchase.payment_method ===
              paymentFilter
          );
      }

      result.sort(
        (a, b) => {
          if (
            sortBy ===
            "date-newest"
          ) {
            return (
              new Date(
                b.purchase_date
              ).getTime() -
              new Date(
                a.purchase_date
              ).getTime()
            );
          }

          if (
            sortBy ===
            "date-oldest"
          ) {
            return (
              new Date(
                a.purchase_date
              ).getTime() -
              new Date(
                b.purchase_date
              ).getTime()
            );
          }

          if (
            sortBy ===
            "amount-highest"
          ) {
            return (
              Number(
                b.total_including_vat
              ) -
              Number(
                a.total_including_vat
              )
            );
          }

          if (
            sortBy ===
            "amount-lowest"
          ) {
            return (
              Number(
                a.total_including_vat
              ) -
              Number(
                b.total_including_vat
              )
            );
          }

          return 0;
        }
      );

      return result;
    }, [
      purchases,
      allocations,
      profiles,
      search,
      allocationFilter,
      paymentFilter,
      sortBy,
    ]);

  /*
    ======================================================
    PAGE STATES
    ======================================================
  */

  if (loading) {
    return (
      <main className="p-6 md:p-10">

        <p className="text-slate-500">
          Loading purchases...
        </p>

      </main>
    );
  }

  if (!production) {
    return (
      <main className="p-6 md:p-10">

        <div className="mx-auto max-w-7xl">

          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

            <p className="text-lg font-medium">
              No active production
            </p>

            <p className="mt-2 text-slate-500">
              Select a production before working with purchases.
            </p>

            <button
              onClick={() =>
                router.push(
                  "/productions"
                )
              }
              className="mt-5 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white"
            >
              Go to Productions
            </button>

          </div>

        </div>

      </main>
    );
  }

  const vatRate =
    Number(
      production.vat_rate
    );

  const vatMultiplier =
    1 +
    vatRate /
      100;

  return (
    <main className="min-h-screen p-6 text-slate-900 md:p-10">

      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex items-center justify-between gap-4">

          <div>

            <h1 className="text-3xl font-bold">
              Purchases
            </h1>

            <p className="mt-2 text-slate-500">
              {
                production.production_name
              }
            </p>

          </div>

          {canAddPurchase && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/purchases/new"
                )
              }
              className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800"
            >
              + Add Purchase
            </button>
          )}

        </div>

        {message && (
          <p className="mb-4 text-sm text-red-600">
            {message}
          </p>
        )}

        {/* ==================================================
            FILTERS
        ================================================== */}

        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            <div>

              <label className="mb-2 block text-sm font-medium">
                Search
              </label>

              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Receipt, item, supplier, allocation or user"
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />

            </div>

            <div>

              <label className="mb-2 block text-sm font-medium">
                Allocation
              </label>

              <select
                value={
                  allocationFilter
                }
                onChange={(
                  event
                ) =>
                  setAllocationFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >

                <option value="All">
                  All
                </option>

                {purchases.some(
                  (purchase) =>
                    !purchase.allocation_id
                ) && (
                  <option value="Unallocated">
                    Historical / Unallocated
                  </option>
                )}

                {allocations.map(
                  (allocation) => (
                    <option
                      key={
                        allocation.id
                      }
                      value={
                        allocation.id
                      }
                    >
                      {
                        allocation.name
                      }
                    </option>
                  )
                )}

              </select>

            </div>

            <div>

              <label className="mb-2 block text-sm font-medium">
                Payment Method
              </label>

              <select
                value={
                  paymentFilter
                }
                onChange={(
                  event
                ) =>
                  setPaymentFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >

                <option>
                  All
                </option>

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
                Sort
              </label>

              <select
                value={
                  sortBy
                }
                onChange={(
                  event
                ) =>
                  setSortBy(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >

                <option value="date-newest">
                  Date — Newest
                </option>

                <option value="date-oldest">
                  Date — Oldest
                </option>

                <option value="amount-highest">
                  Amount — Highest
                </option>

                <option value="amount-lowest">
                  Amount — Lowest
                </option>

              </select>

            </div>

          </div>

          <div className="mt-4 text-sm text-slate-500">

            Showing{" "}
            {
              filteredPurchases.length
            }{" "}
            of{" "}
            {
              purchases.length
            }{" "}
            purchases

          </div>

        </div>

        {/* ==================================================
            PURCHASE TABLE
        ================================================== */}

        {filteredPurchases.length ===
        0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

            <p className="text-lg font-medium">
              No purchases found
            </p>

          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1320px] text-left">

                <thead className="bg-slate-900 text-sm text-white">

                  <tr>

                    <th className="px-5 py-4">
                      Receipt
                    </th>

                    <th className="px-5 py-4">
                      Date
                    </th>

                    <th className="px-5 py-4">
                      Item
                    </th>

                    <th className="px-5 py-4">
                      Allocation
                    </th>

                    <th className="px-5 py-4">
                      Payment
                    </th>

                    <th className="px-5 py-4">
                      Supplier
                    </th>

                    <th className="px-5 py-4 text-right">
                      Before VAT
                    </th>

                    <th className="px-5 py-4 text-right">
                      VAT
                    </th>

                    <th className="px-5 py-4 text-right">
                      Total
                    </th>

                    <th className="px-5 py-4">
                      Activity
                    </th>

                    <th className="px-5 py-4 text-center">
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredPurchases.map(
                    (purchase) => {
                      const total =
                        Number(
                          purchase.total_including_vat
                        );

                      const beforeVat =
                        vatMultiplier >
                        0
                          ? total /
                            vatMultiplier
                          : total;

                      const vat =
                        total -
                        beforeVat;

                      const editable =
                        canEditPurchase(
                          purchase
                        );

                      const creator =
                        auditName(
                          purchase.created_by
                        );

                      const updater =
                        auditName(
                          purchase.updated_by
                        );

                      return (
                        <tr
                          key={
                            purchase.id
                          }
                          className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50"
                        >

                          <td className="px-5 py-4 font-medium">
                            {
                              purchase.receipt
                            }
                          </td>

                          <td className="px-5 py-4">
                            {formatDate(
                              purchase.purchase_date
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {
                              purchase.item
                            }
                          </td>

                          <td className="px-5 py-4">

                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                purchase.allocation_id
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >

                              {allocationName(
                                purchase.allocation_id
                              )}

                            </span>

                          </td>

                          <td className="px-5 py-4">
                            {
                              purchase.payment_method
                            }
                          </td>

                          <td className="px-5 py-4">
                            {
                              purchase.supplier
                            }
                          </td>

                          <td className="px-5 py-4 text-right">
                            AED{" "}
                            {beforeVat.toFixed(
                              2
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            AED{" "}
                            {vat.toFixed(
                              2
                            )}
                          </td>

                          <td className="px-5 py-4 text-right font-semibold">
                            AED{" "}
                            {total.toFixed(
                              2
                            )}
                          </td>

                          {/* ACTIVITY */}

                          <td className="px-5 py-4">

                            <div className="min-w-[150px] text-xs">

                              <p className="text-slate-500">
                                Created
                              </p>

                              <p className="mt-0.5 font-medium text-slate-700">
                                {creator}
                              </p>

                              {updater !==
                                creator && (
                                <>
                                  <p className="mt-2 text-slate-500">
                                    Updated
                                  </p>

                                  <p className="mt-0.5 font-medium text-slate-700">
                                    {updater}
                                  </p>
                                </>
                              )}

                            </div>

                          </td>

                          {/* ACTIONS */}

                          <td className="px-5 py-4">

                            {editable ? (
                              <div className="flex justify-center gap-2">

                                <button
                                  type="button"
                                  onClick={() =>
                                    router.push(
                                      `/purchases/edit/${purchase.id}`
                                    )
                                  }
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDelete(
                                      purchase
                                    )
                                  }
                                  className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                                >
                                  Delete
                                </button>

                              </div>
                            ) : (
                              <div className="text-center text-xs text-slate-400">
                                View only
                              </div>
                            )}

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          </div>
        )}

      </div>

    </main>
  );
}