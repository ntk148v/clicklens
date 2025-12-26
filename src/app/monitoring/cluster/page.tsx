import { Header } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Server, Cpu, MemoryStick, GitMerge } from "lucide-react";

export default function ClusterPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Cluster Monitoring" />

      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-full bg-ch-yellow/10 flex items-center justify-center mx-auto mb-6">
            <Server className="w-8 h-8 text-ch-yellow" />
          </div>
          <h2 className="text-2xl font-bold text-ch-text mb-4">
            Cluster Health
          </h2>
          <p className="text-ch-muted mb-8">
            Monitor CPU, memory, background merges, mutations, and
            Keeper/ZooKeeper status across your cluster.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <Cpu className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">
                  System Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  CPU, memory, and I/O metrics from system.asynchronous_metrics
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <GitMerge className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">
                  Merges & Mutations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Background task queue, active merges, and mutation progress
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <MemoryStick className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Total and per-query memory consumption monitoring
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-ch-muted mt-8 p-4 rounded-lg bg-ch-surface border border-ch-border">
            🚧 Coming soon in Phase 5 — Use the SQL Console to query{" "}
            <code className="text-ch-yellow">system.metrics</code>,{" "}
            <code className="text-ch-yellow">system.events</code>, and{" "}
            <code className="text-ch-yellow">system.asynchronous_metrics</code>{" "}
            directly.
          </p>
        </div>
      </div>
    </div>
  );
}
