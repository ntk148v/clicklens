/**
 * API route for feature roles
 *
 * Feature roles are ClickHouse roles prefixed with 'clicklens_' that enable
 * specific UI features. They are managed by code and not user-editable.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import {
  FEATURE_ROLES,
  FEATURE_ROLE_PREFIX,
  type FeatureRole,
} from "@/lib/rbac";
import { getFeatureRolesQuery } from "@/lib/clickhouse/queries/access";
import { requireCsrf } from "@/lib/auth/csrf";
import { getClusterName } from "@/lib/clickhouse/cluster";
import { quoteIdentifier } from "@/lib/clickhouse/utils";

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
        { status: 401 },
      );
    }

    const client = createClient(config);

    // Check which feature roles exist in ClickHouse
    const result = await client.query<{ name: string }>(
      getFeatureRolesQuery(FEATURE_ROLE_PREFIX),
    );

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

    return NextResponse.json(
      {
        success: false,
        error: isClickHouseError(error)
          ? error.userMessage || error.message
          : error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// POST: Setup/install feature roles (requires ACCESS MANAGEMENT)
export async function POST(
  request: NextRequest
): Promise<
  NextResponse<{ success: boolean; error?: string; created?: string[] }>
> {
  try {
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const client = createClient(config);
    const clusterName = await getClusterName(client);
    const onCluster = clusterName ? ` ON CLUSTER ${quoteIdentifier(clusterName)}` : "";
    const created: string[] = [];

    // Create each feature role with its privileges (using FEATURE_ROLES as source of truth)
    for (const role of FEATURE_ROLES) {
      try {
        // Create the role
        await client.command(`CREATE ROLE IF NOT EXISTS \`${role.id}\`${onCluster}`);

        // Grant privileges
        for (const grant of role.grants) {
          try {
            // Replace 'GRANT' with 'GRANT ON CLUSTER' if needed, but since role grants are hardcoded in lib/rbac:
            const grantSql = onCluster ? grant.replace(/^GRANT /i, `GRANT${onCluster} `) : grant;
            await client.command(grantSql);
          } catch (e) {
            // Continue if individual grant fails
            console.warn(`Failed to execute: ${grant}`, e);
          }
        }

        created.push(role.id);
      } catch (e) {
        console.error(`Failed to create role ${role.id}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      created,
    }, { status: 500 });
  } catch (error) {
    console.error("Error setting up feature roles:", error);

    return NextResponse.json(
      {
        success: false,
        error: isClickHouseError(error)
          ? error.userMessage || error.message
          : error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 },
    );
  }
}
