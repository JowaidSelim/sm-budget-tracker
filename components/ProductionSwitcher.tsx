"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Production = {
  id: string;
  production_name: string;
};

export default function ProductionSwitcher() {
  const supabase = useMemo(() => createClient(), []);

  const [productions, setProductions] = useState<Production[]>([]);
  const [activeProductionId, setActiveProductionId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProductions();
  }, []);

  async function loadProductions() {
    setLoading(true);

    const { data, error } = await supabase
      .from("productions")
      .select(`
        id,
        production_name
      `)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const productionData =
      (data as Production[]) ?? [];

    setProductions(productionData);

    const savedActiveId =
      localStorage.getItem("activeProductionId");

    const activeExists =
      savedActiveId &&
      productionData.some(
        (production) =>
          production.id === savedActiveId
      );

    if (activeExists && savedActiveId) {
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
    }

    setLoading(false);
  }

  function handleChange(
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
      Reload the current page so Dashboard,
      Purchases, Settings and Reports all
      reload using the newly selected production.
    */
    window.location.reload();
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-slate-800 px-3 py-3">
        <p className="text-xs text-slate-400">
          Loading production...
        </p>
      </div>
    );
  }

  if (productions.length === 0) {
    return (
      <div className="rounded-xl bg-slate-800 px-3 py-3">
        <p className="text-xs text-slate-400">
          No production selected
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
        Active Production
      </label>

      <select
        value={activeProductionId}
        onChange={(e) =>
          handleChange(
            e.target.value
          )
        }
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white outline-none transition focus:border-slate-500"
      >
        {productions.map(
          (production) => (
            <option
              key={production.id}
              value={production.id}
            >
              {production.production_name}
            </option>
          )
        )}
      </select>
    </div>
  );
}