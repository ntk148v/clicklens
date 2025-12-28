/**
 * Permission checking logic using Lens User
 */

import {
  createClientWithConfig,
  getLensConfig,
  isLensUserConfigured,
} from "@/lib/clickhouse";

export interface UserPermissions {
  canViewAccess: boolean;
}

/**
 * Check permissions for a user using the Lens User (service account).
 *
 * Checks:
 * 1. Can user view access management? (Needed for Access menu)
 *    - Has `ACCESS MANAGEMENT` privilege
 *    - OR has `SELECT` on `system.users`
 */
export async function getUserPermissions(
  username: string
): Promise<UserPermissions> {
  // Default to false (safe default)
  const permissions: UserPermissions = {
    canViewAccess: false,
  };

  if (!isLensUserConfigured()) {
    console.warn("Lens user not configured, permissions check skipped");
    return permissions;
  }

  const lensConfig = getLensConfig();
  if (!lensConfig) {
    return permissions;
  }

  const client = createClientWithConfig(lensConfig);
  const safeUser = username.replace(/'/g, "''");

  try {
    // Check if user has explicit access management or can read system.users
    // We check both direct grants and grants via roles

    // 1. Get roles
    const rolesResult = await client.query(`
      SELECT granted_role_name as role 
      FROM system.role_grants 
      WHERE user_name = '${safeUser}'
    `);

    const rolesData = rolesResult.data as unknown as Array<{ role: string }>;
    const userRoles = rolesData
      .map((r) => `'${r.role.replace(/'/g, "''")}'`)
      .join(",");

    const grantFilter = userRoles
      ? `(user_name = '${safeUser}' OR role_name IN (${userRoles}))`
      : `user_name = '${safeUser}'`;

    // 2. Check for permissions
    // We look for:
    // - ACCESS MANAGEMENT privilege
    // - OR SELECT on system.users
    const checkQuery = `
      SELECT count() as cnt
      FROM system.grants
      WHERE ${grantFilter}
      AND (
        access_type = 'ACCESS MANAGEMENT'
        OR (
          access_type IN ('SELECT', 'ALL') 
          AND (
            (database = 'system' AND table = 'users')
            OR (database = 'system' AND table = '*')
            OR (database IS NULL) -- Global access
            OR (database = '*')   -- Global access
          )
        )
      )
    `;

    const checkResult = await client.query(checkQuery);
    const checkData = checkResult.data as unknown as Array<{
      cnt: string | number;
    }>;
    const cnt = checkData[0]?.cnt;

    // Check if count > 0 (handling both string and number)
    permissions.canViewAccess = cnt !== 0 && cnt !== "0" && cnt !== undefined;

    return permissions;
  } catch (error) {
    console.error(`Permission check failed for ${username}:`, error);
    return permissions;
  }
}
