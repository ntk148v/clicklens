"use client";

import { create } from "zustand";
import type { SystemUser, SystemRole, SystemGrant } from "@/lib/clickhouse";

interface RoleGrant {
  user_name: string | null;
  role_name: string | null;
  granted_role_name: string;
  with_admin_option: boolean;
}

interface AccessState {
  // Data
  users: SystemUser[];
  roles: SystemRole[];
  grants: SystemGrant[];
  roleGrants: RoleGrant[];

  // State
  loading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchAll: () => Promise<void>;
  refresh: () => Promise<void>;
  invalidate: () => void;
}

export const useAccessStore = create<AccessState>()((set, get) => ({
  users: [],
  roles: [],
  grants: [],
  roleGrants: [],
  loading: false,
  error: null,
  lastFetched: null,

  fetchAll: async () => {
    // Skip if already fetched and not invalidated
    const { lastFetched, loading } = get();
    if (lastFetched && !loading) return;

    set({ loading: true, error: null });

    try {
      const [usersRes, rolesRes, grantsRes, roleGrantsRes] = await Promise.all([
        fetch("/api/clickhouse/access/users"),
        fetch("/api/clickhouse/access/roles"),
        fetch("/api/clickhouse/access/grants"),
        fetch("/api/clickhouse/access/role-grants"),
      ]);

      const [usersData, rolesData, grantsData, roleGrantsData] =
        await Promise.all([
          usersRes.json(),
          rolesRes.json(),
          grantsRes.json(),
          roleGrantsRes.json(),
        ]);

      if (!usersData.success) {
        throw new Error(usersData.error || "Failed to fetch users");
      }

      set({
        users: usersData.data || [],
        roles: rolesData.success ? rolesData.data || [] : [],
        grants: grantsData.success ? grantsData.data || [] : [],
        roleGrants: roleGrantsData.success ? roleGrantsData.data || [] : [],
        loading: false,
        error: null,
        lastFetched: Date.now(),
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  refresh: async () => {
    // Force refresh by invalidating first
    set({ lastFetched: null });
    await get().fetchAll();
  },

  invalidate: () => {
    set({ lastFetched: null });
  },
}));
