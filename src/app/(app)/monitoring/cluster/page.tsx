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
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Server className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Cluster Health</h2>
          <p className="text-muted-foreground mb-8">
            Monitor CPU, memory, background merges, mutations, and
            Keeper/ZooKeeper status across your cluster.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <Card>
              <CardHeader className="pb-2">
                <Cpu className="w-5 h-5 text-primary mb-2" />
                <CardTitle className="text-sm">System Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  CPU, memory, and I/O metrics from system.asynchronous_metrics
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <GitMerge className="w-5 h-5 text-primary mb-2" />
                <CardTitle className="text-sm">Merges & Mutations</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Background task queue, active merges, and mutation progress
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <MemoryStick className="w-5 h-5 text-primary mb-2" />
                <CardTitle className="text-sm">Memory Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Total and per-query memory consumption monitoring
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground mt-8 p-4 rounded-lg bg-muted border">
            🚧 Coming soon — Use the SQL Console to query{" "}
            <code className="text-primary">system.metrics</code>,{" "}
            <code className="text-primary">system.events</code>, and{" "}
            <code className="text-primary">system.asynchronous_metrics</code>{" "}
            directly.
          </p>
        </div>
      </div>
    </div>
  );
}
