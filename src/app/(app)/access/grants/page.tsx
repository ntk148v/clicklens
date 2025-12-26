"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Users,
  Shield,
  Key,
  RefreshCw,
  AlertCircle,
  Loader2,
  Search,
} from "lucide-react";
import type { SystemGrant } from "@/lib/clickhouse";
import Link from "next/link";

export default function GrantsPage() {
  const [grants, setGrants] = useState<SystemGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const fetchGrants = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/clickhouse/access/grants");
      const data = await response.json();
      if (data.success) {
        setGrants(data.data || []);
      } else {
        setError(data.error || "Failed to fetch grants");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, []);

  const filteredGrants = grants.filter((grant) => {
    if (!filter) return true;
    const searchLower = filter.toLowerCase();
    return (
      grant.user_name?.toLowerCase().includes(searchLower) ||
      grant.role_name?.toLowerCase().includes(searchLower) ||
      grant.access_type.toLowerCase().includes(searchLower) ||
      grant.database?.toLowerCase().includes(searchLower) ||
      grant.table?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Access Control">
        <Tabs defaultValue="grants" className="ml-4">
          <TabsList className="h-8">
            <TabsTrigger value="users" className="text-xs" asChild>
              <Link href="/access/users">
                <Users className="w-3.5 h-3.5 mr-1" />
                Users
              </Link>
            </TabsTrigger>
            <TabsTrigger value="roles" className="text-xs" asChild>
              <Link href="/access/roles">
                <Shield className="w-3.5 h-3.5 mr-1" />
                Roles
              </Link>
            </TabsTrigger>
            <TabsTrigger value="grants" className="text-xs" asChild>
              <Link href="/access/grants">
                <Key className="w-3.5 h-3.5 mr-1" />
                Grants
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchGrants}
          disabled={loading}
          className="ml-auto"
        >
          <RefreshCw
            className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </Header>

      <div className="flex-1 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                Error Loading Grants
              </CardTitle>
              <CardDescription className="text-red-600">
                {error}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Make sure ClickHouse is running and accessible. You may need
                SELECT permission on system.grants.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Grants</h2>
                <p className="text-sm text-muted-foreground">
                  {grants.length} permission grant
                  {grants.length !== 1 ? "s" : ""} in ClickHouse
                </p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Filter grants..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Card>
              <ScrollArea className="h-[calc(100vh-320px)]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[150px]">Grantee</TableHead>
                      <TableHead className="w-[180px]">Access Type</TableHead>
                      <TableHead>Database</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Column</TableHead>
                      <TableHead>Options</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGrants.map((grant, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {grant.user_name ? (
                            <Badge variant="default" className="text-xs">
                              👤 {grant.user_name}
                            </Badge>
                          ) : grant.role_name ? (
                            <Badge variant="secondary" className="text-xs">
                              🛡️ {grant.role_name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              grant.is_partial_revoke
                                ? "destructive"
                                : "outline"
                            }
                            className="text-xs font-mono"
                          >
                            {grant.is_partial_revoke && "¬ "}
                            {grant.access_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {grant.database ? (
                            <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                              {grant.database}
                            </code>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              *
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {grant.table ? (
                            <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                              {grant.table}
                            </code>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              *
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {grant.column ? (
                            <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                              {grant.column}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {grant.grant_option && (
                            <Badge variant="outline" className="text-xs">
                              WITH GRANT OPTION
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>

            {filteredGrants.length === 0 && filter && (
              <div className="text-center py-8 text-muted-foreground">
                No grants match "{filter}"
              </div>
            )}

            <div className="p-4 rounded-lg bg-muted border text-sm text-muted-foreground">
              <p>
                <strong>Note:</strong> To modify permissions, use SQL commands
                like{" "}
                <code className="px-1.5 py-0.5 rounded bg-background border text-xs">
                  GRANT SELECT ON db.* TO user
                </code>{" "}
                or{" "}
                <code className="px-1.5 py-0.5 rounded bg-background border text-xs">
                  REVOKE INSERT ON table FROM role
                </code>{" "}
                in the SQL Console.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
