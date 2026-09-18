"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Purchase = {
  id: string;
  production_id: string;
  receipt: string;
  purchase_date: string;
  category: string;
  item: string;
  payment_method: string;
  supplier: string;
  total_including_vat: number;
};

type Production = {
  id: string;
  production_name: string;
  vat_rate: number;
};

export default function PurchasesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [production, setProduction] = useState<Production | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [sortBy, setSortBy] = useState("date-newest");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const activeProductionId =
      localStorage.getItem("activeProductionId");

    if (!activeProductionId) {
      setProduction(null);
      setPurchases([]);
      setLoading(false);
      return;
    }

    const { data: productionData, error: productionError } =
      await supabase
        .from("productions")
        .select("id, production_name, vat_rate")
        .eq("id", activeProductionId)
        .single();

    if (productionError) {
      console.error(productionError);
      setMessage("Could not load the active production.");
      setLoading(false);
      return;
    }

    setProduction(productionData as Production);

    const { data: purchaseData, error: purchaseError } =
      await supabase
        .from("purchases")
        .select(`
          id,
          production_id,
          receipt,
          purchase_date,
          category,
          item,
          payment_method,
          supplier,
          total_including_vat
        `)
        .eq("production_id", activeProductionId);

    if (purchaseError) {
      console.error(purchaseError);
      setMessage("Could not load purchases.");
      setPurchases([]);
      setLoading(false);
      return;
    }

    setPurchases((purchaseData as Purchase[]) ?? []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this purchase?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("purchases")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setPurchases((current) =>
      current.filter((purchase) => purchase.id !== id)
    );
  }

  function formatDate(date: string) {
    if (!date) return "";

    return new Date(`${date}T00:00:00`).toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  const filteredPurchases = useMemo(() => {
    let result = [...purchases];

    const searchTerm = search.trim().toLowerCase();

    if (searchTerm) {
      result = result.filter((purchase) =>
        purchase.receipt.toLowerCase().includes(searchTerm) ||
        purchase.item.toLowerCase().includes(searchTerm) ||
        purchase.supplier.toLowerCase().includes(searchTerm)
      );
    }

    if (categoryFilter !== "All") {
      result = result.filter(
        (purchase) => purchase.category === categoryFilter
      );
    }

    if (paymentFilter !== "All") {
      result = result.filter(
        (purchase) => purchase.payment_method === paymentFilter
      );
    }

    result.sort((a, b) => {
      if (sortBy === "date-newest") {
        return (
          new Date(b.purchase_date).getTime() -
          new Date(a.purchase_date).getTime()
        );
      }

      if (sortBy === "date-oldest") {
        return (
          new Date(a.purchase_date).getTime() -
          new Date(b.purchase_date).getTime()
        );
      }

      if (sortBy === "amount-highest") {
        return (
          Number(b.total_including_vat) -
          Number(a.total_including_vat)
        );
      }

      if (sortBy === "amount-lowest") {
        return (
          Number(a.total_including_vat) -
          Number(b.total_including_vat)
        );
      }

      return 0;
    });

    return result;
  }, [
    purchases,
    search,
    categoryFilter,
    paymentFilter,
    sortBy,
  ]);

  if (loading) {
    return (
      <main className="p-6 md:p-10">
        <p className="text-slate-500">Loading purchases...</p>
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
              Select a production before adding purchases.
            </p>

            <button
              onClick={() => router.push("/productions")}
              className="mt-5 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white"
            >
              Go to Productions
            </button>
          </div>
        </div>
      </main>
    );
  }

  const vatRate = Number(production.vat_rate);
  const vatMultiplier = 1 + vatRate / 100;

  return (
    <main className="min-h-screen p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Purchases
            </h1>

            <p className="mt-2 text-slate-500">
              {production.production_name}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/purchases/new")}
            className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800"
          >
            + Add Purchase
          </button>
        </div>

        {message && (
          <p className="mb-4 text-sm text-red-600">
            {message}
          </p>
        )}

        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            <div>
              <label className="mb-2 block text-sm font-medium">
                Search
              </label>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Receipt, item or supplier"
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Category
              </label>

              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option>All</option>
                <option>Props</option>
                <option>Stage Management</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Payment Method
              </label>

              <select
                value={paymentFilter}
                onChange={(e) =>
                  setPaymentFilter(e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option>All</option>
                <option>Petty Cash</option>
                <option>Credit Card</option>
                <option>Purchase Order</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Sort
              </label>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
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
            Showing {filteredPurchases.length} of{" "}
            {purchases.length} purchases
          </div>
        </div>

        {filteredPurchases.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-medium">
              No purchases found
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-left">

                <thead className="bg-slate-900 text-sm text-white">
                  <tr>
                    <th className="px-5 py-4">Receipt</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Item</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Payment</th>
                    <th className="px-5 py-4">Supplier</th>
                    <th className="px-5 py-4 text-right">
                      Before VAT
                    </th>
                    <th className="px-5 py-4 text-right">
                      VAT
                    </th>
                    <th className="px-5 py-4 text-right">
                      Total
                    </th>
                    <th className="px-5 py-4 text-center">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPurchases.map((purchase) => {
                    const total =
                      Number(purchase.total_including_vat);

                    const beforeVat =
                      vatMultiplier > 0
                        ? total / vatMultiplier
                        : total;

                    const vat =
                      total - beforeVat;

                    return (
                      <tr
                        key={purchase.id}
                        className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 font-medium">
                          {purchase.receipt}
                        </td>

                        <td className="px-5 py-4">
                          {formatDate(purchase.purchase_date)}
                        </td>

                        <td className="px-5 py-4">
                          {purchase.item}
                        </td>

                        <td className="px-5 py-4">
                          {purchase.category}
                        </td>

                        <td className="px-5 py-4">
                          {purchase.payment_method}
                        </td>

                        <td className="px-5 py-4">
                          {purchase.supplier}
                        </td>

                        <td className="px-5 py-4 text-right">
                          AED {beforeVat.toFixed(2)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          AED {vat.toFixed(2)}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold">
                          AED {total.toFixed(2)}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-center gap-2">

                            <button
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
                              onClick={() =>
                                handleDelete(purchase.id)
                              }
                              className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                            >
                              Delete
                            </button>

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}