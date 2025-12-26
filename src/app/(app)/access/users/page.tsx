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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  Shield,
  Key,
  RefreshCw,
  AlertCircle,
  Loader2,
  User,
} from "lucide-react";
import type { SystemUser } from "@/lib/clickhouse";
import Link from "next/link";

export default function UsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/clickhouse/access/users");
      const data = await response.json();
      if (data.success) {
        setUsers(data.data || []);
      } else {
        setError(data.error || "Failed to fetch users");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Header title="Access Control">
        <Tabs defaultValue="users" className="ml-4">
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
          onClick={fetchUsers}
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
                Error Loading Users
              </CardTitle>
              <CardDescription className="text-red-600">
                {error}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Make sure ClickHouse is running and accessible. You may need
                SELECT permission on system.users.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Users</h2>
                <p className="text-sm text-muted-foreground">
                  {users.length} user{users.length !== 1 ? "s" : ""} found in
                  ClickHouse
                </p>
              </div>
            </div>

            <Card>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[200px]">Name</TableHead>
                      <TableHead>Auth Type</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Default Database</TableHead>
                      <TableHead>Default Roles</TableHead>
                      <TableHead>Host Access</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            {user.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="font-mono text-xs"
                          >
                            {user.auth_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.storage}
                        </TableCell>
                        <TableCell>
                          {user.default_database ? (
                            <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                              {user.default_database}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.default_roles_all ? (
                            <Badge variant="secondary" className="text-xs">
                              All Roles
                            </Badge>
                          ) : user.default_roles_list &&
                            user.default_roles_list.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.default_roles_list
                                .slice(0, 3)
                                .map((role) => (
                                  <Badge
                                    key={role}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {role}
                                  </Badge>
                                ))}
                              {user.default_roles_list.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{user.default_roles_list.length - 3} more
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.host_ip && user.host_ip.length > 0 ? (
                            <Badge
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {user.host_ip[0]}
                              {user.host_ip.length > 1 &&
                                ` +${user.host_ip.length - 1}`}
                            </Badge>
                          ) : user.host_names && user.host_names.length > 0 ? (
                            <Badge variant="outline" className="text-xs">
                              {user.host_names[0]}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Any Host
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>

            <div className="p-4 rounded-lg bg-muted border text-sm text-muted-foreground">
              <p>
                <strong>Note:</strong> This view is read-only and reflects
                ClickHouse's native RBAC. To modify users, use SQL commands like{" "}
                <code className="px-1.5 py-0.5 rounded bg-background border text-xs">
                  CREATE USER
                </code>
                ,{" "}
                <code className="px-1.5 py-0.5 rounded bg-background border text-xs">
                  ALTER USER
                </code>
                , or{" "}
                <code className="px-1.5 py-0.5 rounded bg-background border text-xs">
                  DROP USER
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
