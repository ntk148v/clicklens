import type { ClickHouseClient } from "./client";
import { quoteIdentifier, escapeSqlString } from "./utils";

export interface ApproxCountOptions {
  database: string;
  table: string;
  estimatedRows: number;
  whereConditions?: string[];
  clusterName?: string | null;
  isDistributed?: boolean;
}

export interface ApproxCountResult {
  count: number;
  isApproximate: true;
  accuracy: number;
  executionTime?: number;
}

function buildTableSource(options: ApproxCountOptions): string {
  const { database, table, clusterName, isDistributed } = options;
  const quotedDb = quoteIdentifier(database);
  const quotedTable = quoteIdentifier(table);

  if (clusterName && !isDistributed) {
    return `clusterAllReplicas('${escapeSqlString(clusterName)}', ${quotedDb}.${quotedTable})`;
  }
  return `${quotedDb}.${quotedTable}`;
}

export async function executeApproxCount(
  client: ClickHouseClient,
  options: ApproxCountOptions
): Promise<ApproxCountResult> {
  const startTime = Date.now();
  const { database, table, estimatedRows, whereConditions = [] } = options;

  const tableSource = buildTableSource(options);

  const whereClause =
    whereConditions.length > 0
      ? `WHERE ${whereConditions.join(" AND ")}`
      : "";

  let query: string;

  if (estimatedRows >= 1_000_000) {
    query = `SELECT uniqCombined64(*) as cnt FROM ${tableSource} ${whereClause}`;
  } else {
    query = `SELECT count() as cnt FROM ${tableSource} ${whereClause} SAMPLE 0.1`;
  }

  try {
    const result = await client.query(query);
    const count = Number(result.data[0]?.cnt) || 0;
    const executionTime = Date.now() - startTime;

    const accuracy = estimatedRows >= 1_000_000 ? 0.97 : 1.0;

    return {
      count,
      isApproximate: true,
      accuracy,
      executionTime,
    };
  } catch (error) {
    console.error("Approximate count query failed:", error);
    throw error;
  }
}