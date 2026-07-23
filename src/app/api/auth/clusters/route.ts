import { NextResponse } from "next/server";
import { getConfiguredClusters, isLensUserConfigured } from "@/lib/clickhouse";

export async function GET(): Promise<
  NextResponse<{
    success: boolean;
    clusters?: { id: string; label: string }[];
    error?: string;
    defaultClusterId?: string | null;
  }>
> {
  try {
    const isConfigured = isLensUserConfigured();
    if (!isConfigured) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Server not configured. Please set CLICKHOUSE_HOST or CLICKHOUSE_CLUSTERS.",
        },
        { status: 500 },
      );
    }

    const clusters = getConfiguredClusters();
    const defaultClusterId =
      clusters.length > 0 ? clusters[0].id : null;

    return NextResponse.json({
      success: true,
      clusters,
      defaultClusterId,
    });
  } catch (error) {
    console.error("Clusters endpoint error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to read cluster configuration" },
      { status: 500 },
    );
  }
}
