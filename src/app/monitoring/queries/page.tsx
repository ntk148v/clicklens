import { Header } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Activity, Zap, Clock, XOctagon } from "lucide-react";

export default function QueriesPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Query Monitoring" />

      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-full bg-ch-yellow/10 flex items-center justify-center mx-auto mb-6">
            <Activity className="w-8 h-8 text-ch-yellow" />
          </div>
          <h2 className="text-2xl font-bold text-ch-text mb-4">
            Query Monitoring
          </h2>
          <p className="text-ch-muted mb-8">
            Monitor running queries, view query history, identify slow queries,
            and analyze resource consumption.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <Zap className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">
                  Running Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Live view of currently executing queries from system.processes
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <Clock className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">
                  Query History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Browse past queries from system.query_log with duration and
                  resource usage
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <XOctagon className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">
                  Kill Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Terminate long-running or problematic queries with KILL QUERY
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-ch-muted mt-8 p-4 rounded-lg bg-ch-surface border border-ch-border">
            🚧 Coming soon in Phase 4 — Use the SQL Console to query{" "}
            <code className="text-ch-yellow">system.processes</code> and{" "}
            <code className="text-ch-yellow">system.query_log</code> directly.
          </p>
        </div>
      </div>
    </div>
  );
}
