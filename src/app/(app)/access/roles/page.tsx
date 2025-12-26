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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Shield,
  Key,
  RefreshCw,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
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

  // Create role dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");

  // Delete role
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const handleCreateRole = async () => {
    setCreateError(null);

    if (!newRoleName.trim()) {
      setCreateError("Role name is required");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/clickhouse/access/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setCreateOpen(false);
        setNewRoleName("");
        fetchRoles();
      } else {
        setCreateError(data.error || "Failed to create role");
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRole = async (roleName: string) => {
    setDeleting(roleName);

    try {
      const response = await fetch("/api/clickhouse/access/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roleName }),
      });

      const data = await response.json();

      if (data.success) {
        fetchRoles();
      } else {
        setError(data.error || "Failed to delete role");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeleting(null);
    }
  };

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
      </Header>

      <div className="flex-1 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Error Loading Roles
              </CardTitle>
              <CardDescription className="text-destructive/80">
                {error}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Roles</h2>
                <p className="text-sm text-muted-foreground">
                  {roles.length} role{roles.length !== 1 ? "s" : ""} defined
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Create Role
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Role</DialogTitle>
                      <DialogDescription>
                        Create a new role. You can assign permissions after
                        creating.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {createError && (
                        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {createError}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="roleName">Role Name *</Label>
                        <Input
                          id="roleName"
                          placeholder="e.g. read_only"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setCreateOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateRole} disabled={creating}>
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Role"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRoles}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
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
                      <TableHead className="w-[80px]">Actions</TableHead>
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
                                {assignees.slice(0, 3).map((a, i) => (
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
                                  </Badge>
                                ))}
                                {assignees.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{assignees.length - 3}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Not assigned
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  disabled={deleting === role.name}
                                >
                                  {deleting === role.name ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Role
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete role{" "}
                                    <strong>{role.name}</strong>? This will
                                    remove it from all users.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeleteRole(role.name)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
