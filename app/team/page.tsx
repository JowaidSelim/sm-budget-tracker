"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type TheatreRole =
  | "PSM"
  | "SM"
  | "ASM"
  | "Production Manager"
  | "Viewer";

type AccessLevel =
  | "Owner"
  | "Admin"
  | "Member"
  | "Viewer";

type Permissions = {
  can_view_budget: boolean;
  can_view_props: boolean;
  can_edit_props: boolean;
  can_view_stage_management: boolean;
  can_edit_stage_management: boolean;
  can_export_reports: boolean;
  can_edit_production: boolean;
  can_manage_members: boolean;
  can_manage_allocations: boolean;
};

type MembershipRow = Permissions & {
  id: string;
  production_id: string;
  user_id: string;
  role: TheatreRole;
  access_level: AccessLevel;
  created_at: string;
};

type Profile = {
  user_id: string;
  username: string;
  display_name: string | null;
};

type TeamMember =
  MembershipRow & {
    username: string;
    display_name: string | null;
  };

type UserLookupResult = {
  user_id: string;
  username: string;
  display_name: string | null;
};

const emptyPermissions: Permissions = {
  can_view_budget: false,
  can_view_props: false,
  can_edit_props: false,
  can_view_stage_management: false,
  can_edit_stage_management: false,
  can_export_reports: false,
  can_edit_production: false,
  can_manage_members: false,
  can_manage_allocations: false,
};

function permissionsForRole(
  role: TheatreRole,
  accessLevel: AccessLevel
): Permissions {
  if (
    accessLevel === "Owner" ||
    accessLevel === "Admin"
  ) {
    return {
      can_view_budget: true,
      can_view_props: true,
      can_edit_props: true,
      can_view_stage_management: true,
      can_edit_stage_management: true,
      can_export_reports: true,
      can_edit_production: true,
      can_manage_members: true,
      can_manage_allocations: true,
    };
  }

  if (accessLevel === "Viewer") {
    return {
      can_view_budget: false,
      can_view_props: true,
      can_edit_props: false,
      can_view_stage_management: true,
      can_edit_stage_management: false,
      can_export_reports: false,
      can_edit_production: false,
      can_manage_members: false,
      can_manage_allocations: false,
    };
  }

  if (role === "PSM") {
    return {
      can_view_budget: true,
      can_view_props: true,
      can_edit_props: true,
      can_view_stage_management: true,
      can_edit_stage_management: true,
      can_export_reports: true,
      can_edit_production: true,
      can_manage_members: false,
      can_manage_allocations: true,
    };
  }

  if (role === "SM") {
    return {
      can_view_budget: true,
      can_view_props: true,
      can_edit_props: true,
      can_view_stage_management: true,
      can_edit_stage_management: true,
      can_export_reports: true,
      can_edit_production: true,
      can_manage_members: false,
      can_manage_allocations: true,
    };
  }

  if (role === "ASM") {
    return {
      can_view_budget: false,
      can_view_props: true,
      can_edit_props: true,
      can_view_stage_management: false,
      can_edit_stage_management: false,
      can_export_reports: true,
      can_edit_production: false,
      can_manage_members: false,
      can_manage_allocations: false,
    };
  }

  if (role === "Production Manager") {
    return {
      can_view_budget: true,
      can_view_props: true,
      can_edit_props: true,
      can_view_stage_management: true,
      can_edit_stage_management: true,
      can_export_reports: true,
      can_edit_production: true,
      can_manage_members: false,
      can_manage_allocations: true,
    };
  }

  return {
    ...emptyPermissions,
    can_view_props: true,
    can_view_stage_management: true,
  };
}

export default function TeamPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [
    team,
    setTeam,
  ] = useState<TeamMember[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    activeProductionId,
    setActiveProductionId,
  ] = useState<string | null>(
    null
  );

  const [
    canManageMembers,
    setCanManageMembers,
  ] = useState(false);

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    foundUser,
    setFoundUser,
  ] = useState<UserLookupResult | null>(
    null
  );

  const [
    searching,
    setSearching,
  ] = useState(false);

  const [
    adding,
    setAdding,
  ] = useState(false);

  const [
    selectedRole,
    setSelectedRole,
  ] = useState<TheatreRole>(
    "ASM"
  );

  const [
    selectedAccess,
    setSelectedAccess,
  ] = useState<AccessLevel>(
    "Member"
  );

  const [
    permissions,
    setPermissions,
  ] = useState<Permissions>(
    permissionsForRole(
      "ASM",
      "Member"
    )
  );

  const [
    editingMember,
    setEditingMember,
  ] = useState<TeamMember | null>(
    null
  );

  const [
    editRole,
    setEditRole,
  ] = useState<TheatreRole>(
    "ASM"
  );

  const [
    editAccess,
    setEditAccess,
  ] = useState<AccessLevel>(
    "Member"
  );

  const [
    editPermissions,
    setEditPermissions,
  ] = useState<Permissions>(
    emptyPermissions
  );

  const [
    savingEdit,
    setSavingEdit,
  ] = useState(false);

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
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
      setTeam([]);
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
      data: membershipData,
      error: membershipError,
    } = await supabase
      .from(
        "production_members"
      )
      .select(`
        id,
        production_id,
        user_id,
        role,
        access_level,
        can_view_budget,
        can_view_props,
        can_edit_props,
        can_view_stage_management,
        can_edit_stage_management,
        can_export_reports,
        can_edit_production,
        can_manage_members,
        can_manage_allocations,
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

    if (membershipError) {
      console.error(
        membershipError
      );

      setMessage(
        "Could not load the production team."
      );

      setLoading(false);
      return;
    }

    const memberships =
      (membershipData as MembershipRow[]) ??
      [];

    const currentMembership =
      memberships.find(
        (member) =>
          member.user_id ===
          user.id
      );

    setCanManageMembers(
      currentMembership?.can_manage_members ??
        false
    );

    const userIds =
      memberships.map(
        (member) =>
          member.user_id
      );

    if (
      userIds.length === 0
    ) {
      setTeam([]);
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
        userIds
      );

    if (profileError) {
      console.error(
        profileError
      );

      setMessage(
        "Team permissions loaded, but profile information could not be loaded."
      );

      setLoading(false);
      return;
    }

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

    const mergedTeam =
      memberships.map(
        (member) => {
          const profile =
            profileMap.get(
              member.user_id
            );

          return {
            ...member,
            username:
              profile?.username ??
              "unknown",
            display_name:
              profile?.display_name ??
              null,
          };
        }
      );

    setTeam(
      mergedTeam
    );

    setLoading(false);
  }

  async function searchUsername() {
    const cleanUsername =
      username
        .trim()
        .toLowerCase();

    if (!cleanUsername) {
      setMessage(
        "Enter a username first."
      );
      return;
    }

    setSearching(true);
    setMessage("");
    setFoundUser(null);

    const {
      data,
      error,
    } = await supabase.rpc(
      "find_user_by_username",
      {
        lookup_username:
          cleanUsername,
      }
    );

    if (error) {
      console.error(error);

      setMessage(
        "Could not search for that username."
      );

      setSearching(false);
      return;
    }

    const result =
      Array.isArray(data)
        ? data[0]
        : data;

    if (!result) {
      setMessage(
        "No user was found with that username."
      );

      setSearching(false);
      return;
    }

    const userResult =
      result as UserLookupResult;

    const alreadyMember =
      team.some(
        (member) =>
          member.user_id ===
          userResult.user_id
      );

    if (alreadyMember) {
      setMessage(
        "That user is already a member of this production."
      );

      setSearching(false);
      return;
    }

    setFoundUser(
      userResult
    );

    setSelectedRole(
      "ASM"
    );

    setSelectedAccess(
      "Member"
    );

    setPermissions(
      permissionsForRole(
        "ASM",
        "Member"
      )
    );

    setSearching(false);
  }

  function handleRoleChange(
    role: TheatreRole
  ) {
    setSelectedRole(role);

    setPermissions(
      permissionsForRole(
        role,
        selectedAccess
      )
    );
  }

  function handleAccessChange(
    accessLevel: AccessLevel
  ) {
    if (
      accessLevel ===
      "Owner"
    ) {
      return;
    }

    setSelectedAccess(
      accessLevel
    );

    setPermissions(
      permissionsForRole(
        selectedRole,
        accessLevel
      )
    );
  }

  function updatePermission(
    key: keyof Permissions
  ) {
    setPermissions(
      (current) => ({
        ...current,
        [key]:
          !current[key],
      })
    );
  }

  async function addMember() {
    if (
      !activeProductionId ||
      !foundUser
    ) {
      return;
    }

    setAdding(true);
    setMessage("");

    const {
      error,
    } = await supabase
      .from(
        "production_members"
      )
      .insert({
        production_id:
          activeProductionId,

        user_id:
          foundUser.user_id,

        role:
          selectedRole,

        access_level:
          selectedAccess,

        ...permissions,
      });

    if (error) {
      console.error(error);

      setMessage(
        "Could not add this user to the production."
      );

      setAdding(false);
      return;
    }

    setMessage(
      `@${foundUser.username} was added successfully.`
    );

    setUsername("");
    setFoundUser(null);

    await loadTeam();

    setAdding(false);
  }

  function startEditing(
    member: TeamMember
  ) {
    if (
      member.access_level ===
      "Owner"
    ) {
      return;
    }

    setEditingMember(
      member
    );

    setEditRole(
      member.role
    );

    setEditAccess(
      member.access_level
    );

    setEditPermissions({
      can_view_budget:
        member.can_view_budget,

      can_view_props:
        member.can_view_props,

      can_edit_props:
        member.can_edit_props,

      can_view_stage_management:
        member.can_view_stage_management,

      can_edit_stage_management:
        member.can_edit_stage_management,

      can_export_reports:
        member.can_export_reports,

      can_edit_production:
        member.can_edit_production,

      can_manage_members:
        member.can_manage_members,

      can_manage_allocations:
        member.can_manage_allocations,
    });
  }

  function handleEditRoleChange(
    role: TheatreRole
  ) {
    setEditRole(role);

    setEditPermissions(
      permissionsForRole(
        role,
        editAccess
      )
    );
  }

  function handleEditAccessChange(
    accessLevel: AccessLevel
  ) {
    if (
      accessLevel ===
      "Owner"
    ) {
      return;
    }

    setEditAccess(
      accessLevel
    );

    setEditPermissions(
      permissionsForRole(
        editRole,
        accessLevel
      )
    );
  }

  function updateEditPermission(
    key: keyof Permissions
  ) {
    setEditPermissions(
      (current) => ({
        ...current,
        [key]:
          !current[key],
      })
    );
  }

  async function saveMemberEdit() {
    if (!editingMember) {
      return;
    }

    setSavingEdit(true);
    setMessage("");

    const {
      error,
    } = await supabase
      .from(
        "production_members"
      )
      .update({
        role:
          editRole,

        access_level:
          editAccess,

        ...editPermissions,
      })
      .eq(
        "id",
        editingMember.id
      );

    if (error) {
      console.error(error);

      setMessage(
        "Could not update this member."
      );

      setSavingEdit(false);
      return;
    }

    setEditingMember(null);

    setMessage(
      "Team member updated successfully."
    );

    await loadTeam();

    setSavingEdit(false);
  }

  async function removeMember(
    member: TeamMember
  ) {
    if (
      member.access_level ===
      "Owner"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Remove @${member.username} from this production?`
      );

    if (!confirmed) {
      return;
    }

    setMessage("");

    const {
      error,
    } = await supabase
      .from(
        "production_members"
      )
      .delete()
      .eq(
        "id",
        member.id
      );

    if (error) {
      console.error(error);

      setMessage(
        "Could not remove this member."
      );

      return;
    }

    setMessage(
      `@${member.username} was removed from the production.`
    );

    await loadTeam();
  }

  if (loading) {
    return (
      <main className="p-6 md:p-10">
        <p className="text-slate-500">
          Loading team...
        </p>
      </main>
    );
  }

  if (!activeProductionId) {
    return (
      <main className="p-6 md:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold">
              No active production
            </p>

            <p className="mt-2 text-slate-500">
              Select a production before managing its team.
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
            Team
          </h1>

          <p className="mt-2 text-slate-500">
            Manage production members, theatre roles and access permissions.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl bg-slate-200 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        )}

        {/* ==================================================
            ADD MEMBER
        ================================================== */}

        {canManageMembers && (
          <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">

            <h2 className="text-xl font-semibold">
              Add Team Member
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Search by exact username. Email addresses are never exposed to other production members.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">

              <input
                type="text"
                value={username}
                onChange={(event) =>
                  setUsername(
                    event.target.value
                  )
                }
                placeholder="username"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              />

              <button
                type="button"
                onClick={
                  searchUsername
                }
                disabled={
                  searching
                }
                className="rounded-xl bg-slate-900 px-6 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {searching
                  ? "Searching..."
                  : "Find User"}
              </button>

            </div>

            {foundUser && (
              <div className="mt-6 rounded-2xl border border-slate-200 p-5">

                <div>
                  <p className="text-lg font-semibold">
                    {foundUser.display_name ||
                      `@${foundUser.username}`}
                  </p>

                  <p className="text-sm text-slate-500">
                    @{foundUser.username}
                  </p>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">

                  <div>
                    <label className="text-sm font-medium">
                      Theatre Role
                    </label>

                    <select
                      value={
                        selectedRole
                      }
                      onChange={(event) =>
                        handleRoleChange(
                          event.target
                            .value as TheatreRole
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                    >
                      <option value="PSM">
                        PSM
                      </option>

                      <option value="SM">
                        SM
                      </option>

                      <option value="ASM">
                        ASM
                      </option>

                      <option value="Production Manager">
                        Production Manager
                      </option>

                      <option value="Viewer">
                        Viewer
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      App Access
                    </label>

                    <select
                      value={
                        selectedAccess
                      }
                      onChange={(event) =>
                        handleAccessChange(
                          event.target
                            .value as AccessLevel
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                    >
                      <option value="Admin">
                        Admin
                      </option>

                      <option value="Member">
                        Member
                      </option>

                      <option value="Viewer">
                        Viewer
                      </option>
                    </select>
                  </div>

                </div>

                <PermissionEditor
                  permissions={
                    permissions
                  }
                  onToggle={
                    updatePermission
                  }
                />

                <button
                  type="button"
                  onClick={
                    addMember
                  }
                  disabled={
                    adding
                  }
                  className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {adding
                    ? "Adding..."
                    : "Add to Production"}
                </button>

              </div>
            )}

          </section>
        )}

        {/* ==================================================
            TEAM LIST
        ================================================== */}

        <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">

          <div className="flex items-center justify-between gap-4">

            <div>
              <h2 className="text-xl font-semibold">
                Production Team
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {team.length} member
                {team.length === 1
                  ? ""
                  : "s"}
              </p>
            </div>

          </div>

          <div className="mt-6 space-y-4">

            {team.map(
              (member) => (
                <div
                  key={
                    member.id
                  }
                  className="rounded-xl border border-slate-200 p-5"
                >

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                    <div>

                      <div className="flex flex-wrap items-center gap-2">

                        <p className="font-semibold">
                          {member.display_name ||
                            `@${member.username}`}
                        </p>

                        {member.access_level ===
                          "Owner" && (
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                            Owner
                          </span>
                        )}

                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        @{member.username}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                          {member.role}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                          {member.access_level}
                        </span>

                      </div>

                    </div>

                    {canManageMembers &&
                      member.access_level !==
                        "Owner" && (
                        <div className="flex gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              startEditing(
                                member
                              )
                            }
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeMember(
                                member
                              )
                            }
                            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>

                        </div>
                      )}

                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">

                    {member.can_view_budget && (
                      <PermissionBadge>
                        Full Budget
                      </PermissionBadge>
                    )}

                    {member.can_view_props && (
                      <PermissionBadge>
                        Props
                      </PermissionBadge>
                    )}

                    {member.can_edit_props && (
                      <PermissionBadge>
                        Edit Props
                      </PermissionBadge>
                    )}

                    {member.can_view_stage_management && (
                      <PermissionBadge>
                        Stage Management
                      </PermissionBadge>
                    )}

                    {member.can_edit_stage_management && (
                      <PermissionBadge>
                        Edit SM
                      </PermissionBadge>
                    )}

                    {member.can_export_reports && (
                      <PermissionBadge>
                        Reports
                      </PermissionBadge>
                    )}

                    {member.can_manage_allocations && (
                      <PermissionBadge>
                        Allocations
                      </PermissionBadge>
                    )}

                    {member.can_manage_members && (
                      <PermissionBadge>
                        Manage Team
                      </PermissionBadge>
                    )}

                  </div>

                </div>
              )
            )}

          </div>

        </section>

        {/* ==================================================
            EDIT MEMBER MODAL
        ================================================== */}

        {editingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl md:p-8">

              <div className="flex items-start justify-between gap-4">

                <div>
                  <h2 className="text-xl font-semibold">
                    Edit Team Member
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    @{editingMember.username}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditingMember(
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
                    Theatre Role
                  </label>

                  <select
                    value={
                      editRole
                    }
                    onChange={(event) =>
                      handleEditRoleChange(
                        event.target
                          .value as TheatreRole
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                  >
                    <option value="PSM">
                      PSM
                    </option>

                    <option value="SM">
                      SM
                    </option>

                    <option value="ASM">
                      ASM
                    </option>

                    <option value="Production Manager">
                      Production Manager
                    </option>

                    <option value="Viewer">
                      Viewer
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    App Access
                  </label>

                  <select
                    value={
                      editAccess
                    }
                    onChange={(event) =>
                      handleEditAccessChange(
                        event.target
                          .value as AccessLevel
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                  >
                    <option value="Admin">
                      Admin
                    </option>

                    <option value="Member">
                      Member
                    </option>

                    <option value="Viewer">
                      Viewer
                    </option>
                  </select>
                </div>

              </div>

              <PermissionEditor
                permissions={
                  editPermissions
                }
                onToggle={
                  updateEditPermission
                }
              />

              <div className="mt-6 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setEditingMember(
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
                    saveMemberEdit
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

function PermissionEditor({
  permissions,
  onToggle,
}: {
  permissions: Permissions;
  onToggle: (
    key: keyof Permissions
  ) => void;
}) {
  const items: {
    key: keyof Permissions;
    label: string;
    description: string;
  }[] = [
    {
      key:
        "can_view_budget",
      label:
        "View Full Budget",
      description:
        "See the production master budget.",
    },
    {
      key:
        "can_view_props",
      label:
        "View Props",
      description:
        "See Props purchases and spending.",
    },
    {
      key:
        "can_edit_props",
      label:
        "Edit Props",
      description:
        "Create, edit and delete Props purchases.",
    },
    {
      key:
        "can_view_stage_management",
      label:
        "View Stage Management",
      description:
        "See Stage Management purchases.",
    },
    {
      key:
        "can_edit_stage_management",
      label:
        "Edit Stage Management",
      description:
        "Create, edit and delete Stage Management purchases.",
    },
    {
      key:
        "can_export_reports",
      label:
        "Export Reports",
      description:
        "Export reports for data this member is allowed to see.",
    },
    {
      key:
        "can_manage_allocations",
      label:
        "Manage Allocations",
      description:
        "Create and manage budget allocations.",
    },
    {
      key:
        "can_edit_production",
      label:
        "Edit Production",
      description:
        "Change production settings.",
    },
    {
      key:
        "can_manage_members",
      label:
        "Manage Team",
      description:
        "Add, edit and remove production members.",
    },
  ];

  return (
    <div className="mt-6">

      <h3 className="font-medium">
        Permissions
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        The role preset fills these automatically, but you can customize them.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">

        {items.map(
          (item) => (
            <label
              key={
                item.key
              }
              className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4"
            >

              <input
                type="checkbox"
                checked={
                  permissions[
                    item.key
                  ]
                }
                onChange={() =>
                  onToggle(
                    item.key
                  )
                }
                className="mt-1 h-4 w-4"
              />

              <div>
                <p className="text-sm font-medium">
                  {
                    item.label
                  }
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {
                    item.description
                  }
                </p>
              </div>

            </label>
          )
        )}

      </div>

    </div>
  );
}

function PermissionBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
      {children}
    </span>
  );
}