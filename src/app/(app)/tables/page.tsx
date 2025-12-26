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
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Database className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Table Explorer</h2>
          <p className="text-muted-foreground mb-8">
            Browse databases, tables, and parts. View compression ratios, column
            statistics, and hot partitions.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <Card>
              <CardHeader className="pb-2">
                <HardDrive className="w-5 h-5 text-primary mb-2" />
                <CardTitle className="text-sm">Table Size</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  View storage size, row count, and compression ratio for each
                  table
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <Layers className="w-5 h-5 text-primary mb-2" />
                <CardTitle className="text-sm">Parts Info</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Explore data parts, partitions, and merge activity
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <BarChart3 className="w-5 h-5 text-primary mb-2" />
                <CardTitle className="text-sm">Column Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  Column-level size, type, and compression information
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground mt-8 p-4 rounded-lg bg-muted border">
            🚧 Coming soon — Use the SQL Console to query{" "}
            <code className="text-primary">system.tables</code>,{" "}
            <code className="text-primary">system.parts</code>, and{" "}
            <code className="text-primary">system.columns</code> directly.
          </p>
        </div>
      </div>
    </div>
  );
}
