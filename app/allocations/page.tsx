"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type AllocationCategory =
  | "Props"
  | "Stage Management";

type Member = {
  user_id: string;
  username: string;
  display_name: string | null;
  role: string;
};

type Allocation = {
  id: string;
  production_id: string;
  name: string;
  category: AllocationCategory;
  allocated_amount: number;
  assigned_user_id: string | null;
  created_at: string;
};

type MembershipPermissions = {
  can_manage_allocations: boolean;
};

export default function AllocationsPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [
    activeProductionId,
    setActiveProductionId,
  ] = useState<string | null>(
    null
  );

  const [
    allocations,
    setAllocations,
  ] = useState<Allocation[]>(
    []
  );

  const [
    members,
    setMembers,
  ] = useState<Member[]>(
    []
  );

  const [
    canManageAllocations,
    setCanManageAllocations,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    name,
    setName,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState<AllocationCategory>(
    "Props"
  );

  const [
    amount,
    setAmount,
  ] = useState("");

  const [
    assignedUserId,
    setAssignedUserId,
  ] = useState("");

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    editingAllocation,
    setEditingAllocation,
  ] = useState<Allocation | null>(
    null
  );

  const [
    editName,
    setEditName,
  ] = useState("");

  const [
    editCategory,
    setEditCategory,
  ] = useState<AllocationCategory>(
    "Props"
  );

  const [
    editAmount,
    setEditAmount,
  ] = useState("");

  const [
    editAssignedUserId,
    setEditAssignedUserId,
  ] = useState("");

  const [
    savingEdit,
    setSavingEdit,
  ] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    const productionId =
      localStorage.getItem(
        "activeProductionId"
      );

    setActiveProductionId(
      productionId
    );

    if (!productionId) {
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
      data: permissionData,
      error: permissionError,
    } = await supabase
      .from(
        "production_members"
      )
      .select(`
        can_manage_allocations
      `)
      .eq(
        "production_id",
        productionId
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

    if (permissionError) {
      console.error(
        permissionError
      );

      setMessage(
        "Could not load allocation permissions."
      );

      setLoading(false);
      return;
    }

    const currentPermissions =
      permissionData as
        | MembershipPermissions
        | null;

    setCanManageAllocations(
      currentPermissions
        ?.can_manage_allocations ??
        false
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
        assigned_user_id,
        created_at
      `)
      .eq(
        "production_id",
        productionId
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

    setAllocations(
      (allocationData as Allocation[]) ??
        []
    );

    const {
      data: membershipData,
      error: membershipError,
    } = await supabase
      .from(
        "production_members"
      )
      .select(`
        user_id,
        role
      `)
      .eq(
        "production_id",
        productionId
      );

    if (membershipError) {
      console.error(
        membershipError
      );

      setMessage(
        "Allocations loaded, but production members could not be loaded."
      );

      setLoading(false);
      return;
    }

    const memberRows =
      membershipData ?? [];

    const memberIds =
      memberRows.map(
        (member) =>
          member.user_id
      );

    if (
      memberIds.length === 0
    ) {
      setMembers([]);
      setLoading(false);
      return;
    }

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
        memberIds
      );

    if (profileError) {
      console.error(
        profileError
      );

      setMessage(
        "Could not load member profiles."
      );

      setLoading(false);
      return;
    }

    const profileMap =
      new Map(
        (profileData ?? []).map(
          (profile) => [
            profile.user_id,
            profile,
          ]
        )
      );

    const mergedMembers =
      memberRows.map(
        (member) => {
          const profile =
            profileMap.get(
              member.user_id
            );

          return {
            user_id:
              member.user_id,

            role:
              member.role,

            username:
              profile?.username ??
              "unknown",

            display_name:
              profile?.display_name ??
              null,
          };
        }
      );

    setMembers(
      mergedMembers
    );

    setLoading(false);
  }

  function memberLabel(
    userId: string | null
  ) {
    if (!userId) {
      return "Unassigned";
    }

    const member =
      members.find(
        (item) =>
          item.user_id ===
          userId
      );

    if (!member) {
      return "Unknown member";
    }

    if (
      member.display_name
    ) {
      return `${member.display_name} (@${member.username})`;
    }

    return `@${member.username}`;
  }

  async function createAllocation(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !activeProductionId
    ) {
      return;
    }

    const cleanName =
      name.trim();

    const parsedAmount =
      Number(amount);

    if (!cleanName) {
      setMessage(
        "Enter an allocation name."
      );
      return;
    }

    if (
      Number.isNaN(
        parsedAmount
      ) ||
      parsedAmount < 0
    ) {
      setMessage(
        "Enter a valid allocation amount."
      );
      return;
    }

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      setMessage(
        "Could not identify the signed-in user."
      );
      return;
    }

    setCreating(true);
    setMessage("");

    const {
      error,
    } = await supabase
      .from(
        "budget_allocations"
      )
      .insert({
        production_id:
          activeProductionId,

        name:
          cleanName,

        category,

        allocated_amount:
          parsedAmount,

        assigned_user_id:
          assignedUserId ||
          null,

        created_by:
          user.id,
      });

    if (error) {
      console.error(error);

      setMessage(
        "Could not create the budget allocation."
      );

      setCreating(false);
      return;
    }

    setName("");
    setAmount("");
    setAssignedUserId("");
    setCategory(
      "Props"
    );

    setMessage(
      "Budget allocation created successfully."
    );

    await loadPage();

    setCreating(false);
  }

  function startEdit(
    allocation: Allocation
  ) {
    setEditingAllocation(
      allocation
    );

    setEditName(
      allocation.name
    );

    setEditCategory(
      allocation.category
    );

    setEditAmount(
      String(
        allocation.allocated_amount
      )
    );

    setEditAssignedUserId(
      allocation.assigned_user_id ??
        ""
    );
  }

  async function saveEdit() {
    if (
      !editingAllocation
    ) {
      return;
    }

    const cleanName =
      editName.trim();

    const parsedAmount =
      Number(
        editAmount
      );

    if (!cleanName) {
      setMessage(
        "Enter an allocation name."
      );
      return;
    }

    if (
      Number.isNaN(
        parsedAmount
      ) ||
      parsedAmount < 0
    ) {
      setMessage(
        "Enter a valid allocation amount."
      );
      return;
    }

    setSavingEdit(true);
    setMessage("");

    const {
      error,
    } = await supabase
      .from(
        "budget_allocations"
      )
      .update({
        name:
          cleanName,

        category:
          editCategory,

        allocated_amount:
          parsedAmount,

        assigned_user_id:
          editAssignedUserId ||
          null,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        editingAllocation.id
      );

    if (error) {
      console.error(error);

      setMessage(
        "Could not update the allocation."
      );

      setSavingEdit(false);
      return;
    }

    setEditingAllocation(
      null
    );

    setMessage(
      "Budget allocation updated successfully."
    );

    await loadPage();

    setSavingEdit(false);
  }

  async function deleteAllocation(
    allocation: Allocation
  ) {
    const confirmed =
      window.confirm(
        `Delete "${allocation.name}"? Purchases linked to it will remain, but their allocation link will be cleared.`
      );

    if (!confirmed) {
      return;
    }

    setMessage("");

    const {
      error,
    } = await supabase
      .from(
        "budget_allocations"
      )
      .delete()
      .eq(
        "id",
        allocation.id
      );

    if (error) {
      console.error(error);

      setMessage(
        "Could not delete the allocation."
      );

      return;
    }

    setMessage(
      "Budget allocation deleted."
    );

    await loadPage();
  }

  if (loading) {
    return (
      <main className="p-6 md:p-10">
        <p className="text-slate-500">
          Loading allocations...
        </p>
      </main>
    );
  }

  if (
    !activeProductionId
  ) {
    return (
      <main className="p-6 md:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

            <p className="text-lg font-semibold">
              No active production
            </p>

            <p className="mt-2 text-slate-500">
              Select a production before managing budget allocations.
            </p>

          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">

          <h1 className="text-3xl font-bold">
            Budget Allocations
          </h1>

          <p className="mt-2 text-slate-500">
            Create and assign sub-budgets within the active production.
          </p>

        </div>

        {message && (
          <div className="mb-6 rounded-xl bg-slate-200 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        )}

        {canManageAllocations && (
          <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">

            <h2 className="text-xl font-semibold">
              Create Allocation
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Allocations are budget envelopes. They do not count as expenditure.
            </p>

            <form
              onSubmit={
                createAllocation
              }
              className="mt-6 grid gap-4 md:grid-cols-2"
            >

              <div>
                <label className="text-sm font-medium">
                  Allocation Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Props Budget"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Category
                </label>

                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target
                        .value as AllocationCategory
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="Props">
                    Props
                  </option>

                  <option value="Stage Management">
                    Stage Management
                  </option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Allocated Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      event.target.value
                    )
                  }
                  placeholder="3000"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Assigned Member
                </label>

                <select
                  value={
                    assignedUserId
                  }
                  onChange={(event) =>
                    setAssignedUserId(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">
                    Unassigned
                  </option>

                  {members.map(
                    (member) => (
                      <option
                        key={
                          member.user_id
                        }
                        value={
                          member.user_id
                        }
                      >
                        {member.display_name
                          ? `${member.display_name} (@${member.username}) — ${member.role}`
                          : `@${member.username} — ${member.role}`}
                      </option>
                    )
                  )}

                </select>
              </div>

              <div className="md:col-span-2">

                <button
                  type="submit"
                  disabled={
                    creating
                  }
                  className="rounded-xl bg-slate-900 px-6 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {creating
                    ? "Creating..."
                    : "Create Allocation"}
                </button>

              </div>

            </form>

          </section>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">

          <div>
            <h2 className="text-xl font-semibold">
              Current Allocations
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {allocations.length} allocation
              {allocations.length === 1
                ? ""
                : "s"}
            </p>
          </div>

          {allocations.length ===
          0 ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-8 text-center">

              <p className="text-sm text-slate-500">
                No budget allocations have been created yet.
              </p>

            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">

              {allocations.map(
                (allocation) => (
                  <div
                    key={
                      allocation.id
                    }
                    className="rounded-xl border border-slate-200 p-5"
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <p className="font-semibold">
                          {allocation.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {allocation.category}
                        </p>

                      </div>

                      <p className="font-semibold">
                        AED{" "}
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
                      </p>

                    </div>

                    <div className="mt-5">

                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Assigned To
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        {memberLabel(
                          allocation.assigned_user_id
                        )}
                      </p>

                    </div>

                    {canManageAllocations && (
                      <div className="mt-5 flex gap-2">

                        <button
                          type="button"
                          onClick={() =>
                            startEdit(
                              allocation
                            )
                          }
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteAllocation(
                              allocation
                            )
                          }
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>

                      </div>
                    )}

                  </div>
                )
              )}

            </div>
          )}

        </section>

        {editingAllocation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl md:p-8">

              <div className="flex items-start justify-between gap-4">

                <div>
                  <h2 className="text-xl font-semibold">
                    Edit Allocation
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditingAllocation(
                      null
                    )
                  }
                  className="text-sm text-slate-500 hover:text-slate-900"
                >
                  Close
                </button>

              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">

                <div>
                  <label className="text-sm font-medium">
                    Allocation Name
                  </label>

                  <input
                    type="text"
                    value={
                      editName
                    }
                    onChange={(event) =>
                      setEditName(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Category
                  </label>

                  <select
                    value={
                      editCategory
                    }
                    onChange={(event) =>
                      setEditCategory(
                        event.target
                          .value as AllocationCategory
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                  >
                    <option value="Props">
                      Props
                    </option>

                    <option value="Stage Management">
                      Stage Management
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Allocated Amount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      editAmount
                    }
                    onChange={(event) =>
                      setEditAmount(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Assigned Member
                  </label>

                  <select
                    value={
                      editAssignedUserId
                    }
                    onChange={(event) =>
                      setEditAssignedUserId(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                  >

                    <option value="">
                      Unassigned
                    </option>

                    {members.map(
                      (member) => (
                        <option
                          key={
                            member.user_id
                          }
                          value={
                            member.user_id
                          }
                        >
                          {member.display_name
                            ? `${member.display_name} (@${member.username}) — ${member.role}`
                            : `@${member.username} — ${member.role}`}
                        </option>
                      )
                    )}

                  </select>
                </div>

              </div>

              <div className="mt-6 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setEditingAllocation(
                      null
                    )
                  }
                  className="rounded-xl border border-slate-300 px-5 py-3 font-medium"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    saveEdit
                  }
                  disabled={
                    savingEdit
                  }
                  className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50"
                >
                  {savingEdit
                    ? "Saving..."
                    : "Save Changes"}
                </button>

              </div>

            </div>
          </div>
        )}

      </div>
    </main>
  );
}