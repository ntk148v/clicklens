import { ClickHouseClient } from "./clients/types";
import { escapeSqlString } from "./utils";

export async function getTableEngine(
  client: ClickHouseClient,
  database: string,
  table: string,
): Promise<string> {
  const query = `
    SELECT engine
    FROM system.tables
    WHERE database = '${escapeSqlString(database)}'
      AND name = '${escapeSqlString(table)}'
  `;
  try {
    const res = await client.query<{ engine: string }>(query);
    return res.data?.[0]?.engine || "";
  } catch (err) {
    console.error("Failed to fetch table engine", err);
    return "";
  }
}
