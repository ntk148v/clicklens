/**
 * API route for health checks
 * GET /api/clickhouse/monitoring/health
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import {
  HEALTH_CHECKS_QUERY,
  type HealthCheck,
  type HealthSummary,
  type HealthStatus,
  type MonitoringApiResponse,
} from "@/lib/clickhouse/monitoring";

interface HealthCheckRow {
  id: string;
  name: string;
  description: string;
  value: number;
  message: string;
}

// Health check thresholds
const THRESHOLDS: Record<string, { warning: number; critical: number; operator: "gt" | "lt" | "eq" }> = {
  readonly_replicas: { warning: 0, critical: 1, operator: "gt" },
  max_parts_per_partition: { warning: 300, critical: 500, operator: "gt" },
  delayed_inserts: { warning: 0, critical: 5, operator: "gt" },
  rejected_inserts: { warning: 0, critical: 1, operator: "gt" },
  zookeeper_exceptions: { warning: 0, critical: 10, operator: "gt" },
  distributed_files_to_insert: { warning: 100, critical: 1000, operator: "gt" },
  replicated_data_loss: { warning: 0, critical: 1, operator: "gt" },
};

function getHealthStatus(id: string, value: number): HealthStatus {
  const threshold = THRESHOLDS[id];
  if (!threshold) return "ok";

  const { warning, critical, operator } = threshold;

  if (operator === "gt") {
    if (value >= critical) return "critical";
    if (value > warning) return "warning";
    return "ok";
  } else if (operator === "lt") {
    if (value <= critical) return "critical";
    if (value < warning) return "warning";
    return "ok";
  }

  return "ok";
}

function getHealthMessage(id: string, value: number, status: HealthStatus): string {
  const messages: Record<string, Record<HealthStatus, string>> = {
    server_responsive: {
      ok: "Server is responding normally",
      warning: "Server is responding slowly",
      critical: "Server is not responding",
      unknown: "Unable to check server status",
    },
    readonly_replicas: {
      ok: "All replicas are writable",
      warning: "Some replicas may be readonly",
      critical: `${value} replica(s) are in readonly mode`,
      unknown: "Unable to check replica status",
    },
    max_parts_per_partition: {
      ok: `Parts count (${value}) is within normal range`,
      warning: `Parts count (${value}) is approaching limit`,
      critical: `Parts count (${value}) is too high - inserts may be delayed or rejected`,
      unknown: "Unable to check parts count",
    },
    delayed_inserts: {
      ok: "No delayed inserts",
      warning: `${value} insert(s) are delayed`,
      critical: `${value} insert(s) are delayed - high parts count`,
      unknown: "Unable to check delayed inserts",
    },
    rejected_inserts: {
      ok: "No rejected inserts",
      warning: `${value} insert(s) have been rejected`,
      critical: `${value} insert(s) rejected - too many parts`,
      unknown: "Unable to check rejected inserts",
    },
    zookeeper_exceptions: {
      ok: "No ZooKeeper exceptions",
      warning: `${value} ZooKeeper exception(s) detected`,
      critical: `${value} ZooKeeper hardware exception(s) - check connectivity`,
      unknown: "Unable to check ZooKeeper status",
    },
    distributed_files_to_insert: {
      ok: "Distributed queue is healthy",
      warning: `${value} files pending in distributed queue`,
      critical: `${value} files pending - distributed queue is backing up`,
      unknown: "Unable to check distributed queue",
    },
    replicated_data_loss: {
      ok: "No data loss events",
      warning: `${value} data loss event(s) detected`,
      critical: `${value} data loss event(s) - investigate immediately`,
      unknown: "Unable to check data loss events",
    },
  };

  return messages[id]?.[status] || `Value: ${value}`;
}

export async function GET(): Promise<NextResponse<MonitoringApiResponse<HealthSummary>>> {
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
    const result = await client.query<HealthCheckRow>(HEALTH_CHECKS_QUERY);

    const now = new Date().toISOString();
    const checks: HealthCheck[] = result.data.map((row) => {
      const status = getHealthStatus(row.id, row.value);
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        status,
        value: row.value,
        threshold: THRESHOLDS[row.id]
          ? {
              warning: THRESHOLDS[row.id].warning,
              critical: THRESHOLDS[row.id].critical,
            }
          : undefined,
        message: getHealthMessage(row.id, row.value, status),
        lastChecked: now,
      };
    });

    // Calculate overall status
    const criticalCount = checks.filter((c) => c.status === "critical").length;
    const warningCount = checks.filter((c) => c.status === "warning").length;
    const okCount = checks.filter((c) => c.status === "ok").length;

    let overallStatus: HealthStatus = "ok";
    if (criticalCount > 0) overallStatus = "critical";
    else if (warningCount > 0) overallStatus = "warning";

    return NextResponse.json({
      success: true,
      data: {
        overallStatus,
        checks,
        okCount,
        warningCount,
        criticalCount,
      },
    });
  } catch (error) {
    console.error("Health check error:", error);

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
