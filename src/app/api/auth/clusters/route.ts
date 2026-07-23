import { NextResponse } from "next/server";
import { getConfiguredClusters } from "@/lib/clickhouse";

export async function GET(): Promise<
  NextResponse<{
    success: boolean;
    clusters?: { id: string; label: string }[];
    defaultClusterId?: string | null;
  }>
> {
  try {
    const clusters = getConfiguredClusters();
    const defaultClusterId =
      clusters.length > 0 ? clusters[0].id : null;

    return NextResponse.json({ success: true, clusters, defaultClusterId });
  } catch (error) {
    console.error("Clusters endpoint error:", error);
    return NextResponse.json(
      { success: true, clusters: [], defaultClusterId: null },
      { status: 200 },
    );
  }
}
