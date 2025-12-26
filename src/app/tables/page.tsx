import { Header } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Database, HardDrive, Layers, BarChart3 } from "lucide-react";

export default function TablesPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Table Explorer" />

      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-full bg-ch-yellow/10 flex items-center justify-center mx-auto mb-6">
            <Database className="w-8 h-8 text-ch-yellow" />
          </div>
          <h2 className="text-2xl font-bold text-ch-text mb-4">
            Table Explorer
          </h2>
          <p className="text-ch-muted mb-8">
            Browse databases, tables, and parts. View compression ratios, column
            statistics, and hot partitions.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <HardDrive className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">
                  Table Size
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  View storage size, row count, and compression ratio for each
                  table
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <Layers className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">
                  Parts Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Explore data parts, partitions, and merge activity
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-ch-surface border-ch-border">
              <CardHeader className="pb-2">
                <BarChart3 className="w-5 h-5 text-ch-yellow mb-2" />
                <CardTitle className="text-sm text-ch-text">
                  Column Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Column-level size, type, and compression information
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-ch-muted mt-8 p-4 rounded-lg bg-ch-surface border border-ch-border">
            🚧 Coming soon in Phase 3 — Use the SQL Console to query{" "}
            <code className="text-ch-yellow">system.tables</code>,{" "}
            <code className="text-ch-yellow">system.parts</code>, and{" "}
            <code className="text-ch-yellow">system.columns</code> directly.
          </p>
        </div>
      </div>
    </div>
  );
}
