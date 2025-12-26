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
import {
  Users,
  Shield,
  Key,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { SystemRole } from "@/lib/clickhouse";
import Link from "next/link";

interface RoleGrant {
  user_name: string | null;
  role_name: string | null;
  granted_role_name: string;
  with_admin_option: boolean;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [roleGrants, setRoleGrants] = useState<RoleGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, grantsRes] = await Promise.all([
        fetch("/api/clickhouse/access/roles"),
        fetch("/api/clickhouse/access/role-grants"),
      ]);

      const rolesData = await rolesRes.json();
      const grantsData = await grantsRes.json();

      if (rolesData.success) {
        setRoles(rolesData.data || []);
      } else {
        setError(rolesData.error || "Failed to fetch roles");
        return;
      }

      if (grantsData.success) {
        setRoleGrants(grantsData.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  // Get users/roles that have a specific role
  const getRoleAssignees = (roleName: string) => {
    return roleGrants
      .filter((g) => g.granted_role_name === roleName)
      .map((g) => ({
        name: g.user_name || g.role_name,
        type: g.user_name ? "user" : "role",
        withAdmin: g.with_admin_option,
      }));
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Access Control">
        <Tabs defaultValue="roles" className="ml-4">
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
          onClick={fetchRoles}
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
                Error Loading Roles
              </CardTitle>
              <CardDescription className="text-red-600">
                {error}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Make sure ClickHouse is running and accessible. You may need
                SELECT permission on system.roles.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Roles</h2>
                <p className="text-sm text-muted-foreground">
                  {roles.length} role{roles.length !== 1 ? "s" : ""} defined in
                  ClickHouse
                </p>
              </div>
            </div>

            <Card>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[200px]">Role Name</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Assigned To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => {
                      const assignees = getRoleAssignees(role.name);
                      return (
                        <TableRow key={role.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-muted-foreground" />
                              {role.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {role.storage}
                          </TableCell>
                          <TableCell>
                            {assignees.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {assignees.slice(0, 5).map((a, i) => (
                                  <Badge
                                    key={i}
                                    variant={
                                      a.type === "user"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="text-xs"
                                  >
                                    {a.type === "user" ? "👤" : "🛡️"} {a.name}
                                    {a.withAdmin && " (admin)"}
                                  </Badge>
                                ))}
                                {assignees.length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{assignees.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Not assigned
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>

            <div className="p-4 rounded-lg bg-muted border text-sm text-muted-foreground">
              <p>
                <strong>Note:</strong> To create or modify roles, use SQL
                commands like{" "}
                <code className="px-1.5 py-0.5 rounded bg-background border text-xs">
                  CREATE ROLE
                </code>
                ,{" "}
                <code className="px-1.5 py-0.5 rounded bg-background border text-xs">
                  GRANT role TO user
                </code>
                , or{" "}
                <code className="px-1.5 py-0.5 rounded bg-background border text-xs">
                  DROP ROLE
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
