import { NextResponse } from "next/server";
import { getConfiguredClusters } from "@/lib/clickhouse";

export async function GET() {
  const clusters = getConfiguredClusters();
  const defaultClusterId = clusters.length > 0 ? clusters[0].id : null;
  return NextResponse.json({ success: true, clusters, defaultClusterId });
}
