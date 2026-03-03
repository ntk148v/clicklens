/**
 * Grant checking utilities
 *
 * Provides robust global access detection using user-credential probes
 * as a fallback when system.grants doesn't reflect the user's effective
 * privileges (e.g., XML-configured users, GRANT ALL from access_management).
 */

import { createClient } from "./client";
import { type ClickHouseConfig } from "./config";
import { escapeSqlString } from "./utils";

/**
 * Check if a user has global access using SHOW GRANTS.
 *
 * Uses LENS_USER to run SHOW GRANTS FOR the target user.
 * SHOW GRANTS always returns the consolidated effective grants
 * from all sources (SQL, XML config, access_management).
 */
export async function hasGlobalAccessViaShowGrants(
  lensConfig: ClickHouseConfig,
  username: string,
): Promise<boolean> {
  try {
    const client = createClient(lensConfig);
    const safeUser = escapeSqlString(username);

    const result = await client.query(`SHOW GRANTS FOR '${safeUser}'`);
    const grants = result.data as unknown as Array<Record<string, string>>;

    // SHOW GRANTS returns rows with a single column (name varies).
    // Use Object.values to get the value regardless of column name.
    // Each row is like: "GRANT ALL ON *.* TO default WITH GRANT OPTION"
    return grants.some((row) => {
      const line = Object.values(row)[0] || "";
      return /GRANT\s+(ALL|SELECT)\s+ON\s+\*\.\*/.test(line);
    });
  } catch {
    return false;
  }
}

/**
 * Check if a user has global access by probing with their own credentials.
 *
 * This is the most reliable fallback — it tries SHOW DATABASES using the
 * user's own client. If the user can see non-system databases, they have
 * database access. This works regardless of how their grants are configured
 * (SQL, XML, access_management).
 */
export async function probeUserDatabaseAccess(
  userConfig: ClickHouseConfig,
): Promise<{ hasAccess: boolean; databases: string[] }> {
  const SYSTEM_DATABASES = [
    "system",
    "information_schema",
    "INFORMATION_SCHEMA",
  ];

  try {
    const client = createClient(userConfig);
    const result = await client.query("SHOW DATABASES");
    const dbs = result.data as unknown as Array<Record<string, string>>;

    // Extract database names from the result (column name may vary)
    const allDbs = dbs
      .map((row) => Object.values(row)[0] || "")
      .filter(Boolean);

    const userDbs = allDbs.filter((name) => !SYSTEM_DATABASES.includes(name));

    return {
      hasAccess: allDbs.length > 0,
      databases: userDbs,
    };
  } catch {
    return { hasAccess: false, databases: [] };
  }
}

/**
 * Check if a user can browse tables by probing system.tables with their credentials.
 */
export async function probeUserTableAccess(
  userConfig: ClickHouseConfig,
): Promise<boolean> {
  try {
    const client = createClient(userConfig);
    await client.query("SELECT 1 FROM system.tables LIMIT 1");
    return true;
  } catch {
    return false;
  }
}
