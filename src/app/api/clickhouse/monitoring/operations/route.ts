/**
 * API route for background operations (merges & mutations)
 * GET /api/clickhouse/monitoring/operations
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import {
  MERGE_SUMMARY_QUERY,
  MUTATION_SUMMARY_QUERY,
  getMergesQuery,
  getMutationsQuery,
  type MergeInfo,
  type MutationInfo,
  type OperationsResponse,
  type MonitoringApiResponse,
} from "@/lib/clickhouse/monitoring";
import { getClusterName } from "@/lib/clickhouse/cluster";

interface MergeSummaryRow {
  activeMerges: number;
  totalBytesProcessing: number;
  avgProgress: number;
}

interface MutationSummaryRow {
  activeMutations: number;
  failedMutations: number;
  totalPartsToDo: number;
}

// Mutation row from query (partsToDo is a string array, needs conversion)
interface MutationRow {
  database: string;
  table: string;
  mutationId: string;
  command: string;
  createTime: string;
  partsToDo: string[];
  isDone: boolean;
  latestFailedPart: string;
  latestFailTime: string;
  latestFailReason: string;
}

export async function GET(): Promise<
  NextResponse<MonitoringApiResponse<OperationsResponse>>
> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 401,
            message: "Not authenticated",
            type: "AUTH_REQUIRED",
            userMessage: "Please log in to ClickHouse first",
          },
        },
        { status: 401 }
      );
    }

    const client = createClient(config);
    const clusterName = await getClusterName(client);

    // Fetch all data in parallel
    const [
      mergesResult,
      mutationsResult,
      mergeSummaryResult,
      mutationSummaryResult,
    ] = await Promise.all([
      client.query<MergeInfo>(getMergesQuery(clusterName)),
      client.query<MutationRow>(getMutationsQuery(clusterName)),
      client.query<MergeSummaryRow>(MERGE_SUMMARY_QUERY),
      client.query<MutationSummaryRow>(MUTATION_SUMMARY_QUERY),
    ]);

    const mergeSummary = mergeSummaryResult.data[0] || {
      activeMerges: 0,
      totalBytesProcessing: 0,
      avgProgress: 0,
    };

    const mutationSummary = mutationSummaryResult.data[0] || {
      activeMutations: 0,
      failedMutations: 0,
      totalPartsToDo: 0,
    };

    // Transform mutation rows to proper type
    const mutations: MutationInfo[] = mutationsResult.data.map((row) => ({
      database: row.database,
      table: row.table,
      mutationId: row.mutationId,
      command: row.command,
      createTime: row.createTime,
      blockNumbers: {},
      partsToDo: Array.isArray(row.partsToDo) ? row.partsToDo.length : 0,
      isDone: row.isDone,
      latestFailedPart: row.latestFailedPart,
      latestFailTime: row.latestFailTime,
      latestFailReason: row.latestFailReason,
    }));

    return NextResponse.json({
      success: true,
      data: {
        merges: mergesResult.data,
        mutations,
        mergeSummary,
        mutationSummary,
      },
    });
  } catch (error) {
    console.error("Monitoring operations error:", error);

    if (isClickHouseError(error)) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          type: error.type,
          userMessage: error.userMessage || error.message,
        },
      });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 500,
        message: error instanceof Error ? error.message : "Unknown error",
        type: "INTERNAL_ERROR",
        userMessage: "An unexpected error occurred",
      },
    });
  }
}
