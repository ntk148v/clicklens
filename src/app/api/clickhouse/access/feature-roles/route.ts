/**
 * API route for feature roles
 *
 * Feature roles are ClickHouse roles prefixed with 'clicklens_' that enable
 * specific UI features. They are managed by code and not user-editable.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";
import {
  FEATURE_ROLES,
  FEATURE_ROLE_PREFIX,
  type FeatureRole,
} from "@/lib/rbac";

export interface FeatureRolesResponse {
  success: boolean;
  data?: {
    available: FeatureRole[];
    installed: string[];
  };
  error?: string;
}

// GET: List available feature roles and check which are installed
export async function GET(): Promise<NextResponse<FeatureRolesResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);

    // Check which feature roles exist in ClickHouse
    const result = await client.query<{ name: string }>(`
      SELECT name
      FROM system.roles
      WHERE name LIKE '${FEATURE_ROLE_PREFIX}%'
    `);

    const installedRoles = result.data.map((r) => r.name);

    return NextResponse.json({
      success: true,
      data: {
        available: FEATURE_ROLES,
        installed: installedRoles,
      },
    });
  } catch (error) {
    console.error("Error fetching feature roles:", error);

    return NextResponse.json({
      success: false,
      error: isClickHouseError(error)
        ? error.userMessage || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    });
  }
}

// POST: Setup/install feature roles (requires ACCESS MANAGEMENT)
export async function POST(
  request: NextRequest
): Promise<
  NextResponse<{ success: boolean; error?: string; created?: string[] }>
> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);
    const created: string[] = [];

    // Create each feature role with its privileges
    const roleDefinitions = [
      {
        name: "clicklens_table_explorer",
        grants: [
          "GRANT SHOW DATABASES ON *.* TO `clicklens_table_explorer`",
          "GRANT SHOW TABLES ON *.* TO `clicklens_table_explorer`",
          "GRANT SHOW COLUMNS ON *.* TO `clicklens_table_explorer`",
          "GRANT SHOW DICTIONARIES ON *.* TO `clicklens_table_explorer`",
          "GRANT SELECT ON system.tables TO `clicklens_table_explorer`",
          "GRANT SELECT ON system.columns TO `clicklens_table_explorer`",
          "GRANT SELECT ON system.databases TO `clicklens_table_explorer`",
        ],
      },
      {
        name: "clicklens_query_monitor",
        grants: [
          "GRANT KILL QUERY ON *.* TO `clicklens_query_monitor`",
          "GRANT SELECT ON system.processes TO `clicklens_query_monitor`",
          "GRANT SELECT ON system.query_log TO `clicklens_query_monitor`",
        ],
      },
      {
        name: "clicklens_cluster_monitor",
        grants: [
          "GRANT SELECT ON system.clusters TO `clicklens_cluster_monitor`",
          "GRANT SELECT ON system.replicas TO `clicklens_cluster_monitor`",
          "GRANT SELECT ON system.replication_queue TO `clicklens_cluster_monitor`",
          "GRANT SELECT ON system.metrics TO `clicklens_cluster_monitor`",
          "GRANT SELECT ON system.events TO `clicklens_cluster_monitor`",
          "GRANT SELECT ON system.asynchronous_metrics TO `clicklens_cluster_monitor`",
          "GRANT SELECT ON system.settings TO `clicklens_cluster_monitor`",
          "GRANT SELECT ON system.disks TO `clicklens_cluster_monitor`",
          "GRANT SELECT ON system.parts TO `clicklens_cluster_monitor`",
        ],
      },
      {
        name: "clicklens_user_admin",
        grants: ["GRANT ACCESS MANAGEMENT ON *.* TO `clicklens_user_admin`"],
      },
      {
        name: "clicklens_table_admin",
        grants: [
          "GRANT CREATE TABLE ON *.* TO `clicklens_table_admin`",
          "GRANT DROP TABLE ON *.* TO `clicklens_table_admin`",
          "GRANT ALTER TABLE ON *.* TO `clicklens_table_admin`",
          "GRANT TRUNCATE ON *.* TO `clicklens_table_admin`",
          "GRANT OPTIMIZE ON *.* TO `clicklens_table_admin`",
        ],
      },
    ];

    for (const role of roleDefinitions) {
      try {
        // Create the role
        await client.command(`CREATE ROLE IF NOT EXISTS \`${role.name}\``);

        // Grant privileges
        for (const grant of role.grants) {
          try {
            await client.command(grant);
          } catch (e) {
            // Continue if individual grant fails
            console.warn(`Failed to execute: ${grant}`, e);
          }
        }

        created.push(role.name);
      } catch (e) {
        console.error(`Failed to create role ${role.name}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      created,
    });
  } catch (error) {
    console.error("Error setting up feature roles:", error);

    return NextResponse.json({
      success: false,
      error: isClickHouseError(error)
        ? error.userMessage || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    });
  }
}
