"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { useAuth } from "@/components/auth";
import { useRouter } from "next/navigation";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Shield,
  RefreshCw,
  AlertCircle,
  Loader2,
  User,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
} from "lucide-react";
import type { SystemUser, SystemRole } from "@/lib/clickhouse";
import Link from "next/link";
import { PaginationControls } from "@/components/monitoring";

interface UserWithRoles extends SystemUser {
  assigned_roles?: string[];
}

export default function UsersPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const paginatedUsers = users.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(users.length / pageSize);

  // Create/Edit user dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    password: "",
    confirmPassword: "",
    selectedRoles: [] as string[],
  });

  // Delete user
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !permissions?.canManageUsers) {
      router.push("/");
    }
  }, [authLoading, permissions, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/clickhouse/access/users"),
        fetch("/api/clickhouse/access/roles"),
      ]);

      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();

      if (usersData.success) {
        setUsers(usersData.data || []);
      } else {
        setError(usersData.error || "Failed to fetch users");
        return;
      }

      if (rolesData.success) {
        setRoles(rolesData.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateDialog = () => {
    setIsEditing(false);
    setFormData({
      name: "",
      password: "",
      confirmPassword: "",
      selectedRoles: [],
    });
    setDialogError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (user: UserWithRoles) => {
    setIsEditing(true);
    setFormData({
      name: user.name,
      password: "",
      confirmPassword: "",
      selectedRoles: user.assigned_roles || [],
    });
    setDialogError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setDialogError(null);

    if (!isEditing && !formData.name.trim()) {
      setDialogError("Username is required");
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      setDialogError("Passwords do not match");
      return;
    }

    setSaving(true);

    try {
      const endpoint = "/api/clickhouse/access/users";
      const method = isEditing ? "PUT" : "POST";

      const body = isEditing
        ? {
            name: formData.name,
            newPassword: formData.password || undefined,
            roles: formData.selectedRoles,
          }
        : {
            name: formData.name.trim(),
            password: formData.password || undefined,
            roles: formData.selectedRoles,
          };

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        setDialogOpen(false);
        fetchData();
      } else {
        setDialogError(
          data.error || `Failed to ${isEditing ? "update" : "create"} user`
        );
      }
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userName: string) => {
    setDeleting(userName);

    try {
      const response = await fetch("/api/clickhouse/access/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: userName }),
      });

      const data = await response.json();

      if (data.success) {
        fetchData();
      } else {
        setError(data.error || "Failed to delete user");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeleting(null);
    }
  };

  const toggleRole = (roleName: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedRoles: prev.selectedRoles.includes(roleName)
        ? prev.selectedRoles.filter((r) => r !== roleName)
        : [...prev.selectedRoles, roleName],
    }));
  };

  if (authLoading || (!permissions?.canManageUsers && !authLoading)) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
                Error Loading Users
              </CardTitle>
              <CardDescription className="text-destructive/80">
                {error}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You may need ACCESS MANAGEMENT privileges to view users.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Users</h2>
                <p className="text-sm text-muted-foreground">
                  {users.length} user{users.length !== 1 ? "s" : ""} • Users are
                  assigned roles only
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-1" />
                  Create User
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchData}
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Name</TableHead>
                      <TableHead>Auth Type</TableHead>
                      <TableHead>Assigned Roles</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground py-8"
                        >
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedUsers.map((user) => (
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
                          <TableCell>
                            {user.assigned_roles &&
                            user.assigned_roles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {user.assigned_roles.map((role) => (
                                  <Badge
                                    key={role}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    <Shield className="w-3 h-3 mr-1" />
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                No roles assigned
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(user)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    disabled={deleting === user.name}
                                  >
                                    {deleting === user.name ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete User
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete user{" "}
                                      <strong>{user.name}</strong>? This action
                                      cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDelete(user.name)}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                totalItems={users.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </Card>
          </div>
        )}
      </div>

      {/* Create/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit User" : "Create User"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update user password and role assignments."
                : "Create a new user and assign roles. Privileges are managed at the role level."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {dialogError && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {dialogError}
              </div>
            )}

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="name">Username *</Label>
                <Input
                  id="name"
                  placeholder="e.g. analyst"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">
                {isEditing
                  ? "New Password (leave empty to keep current)"
                  : "Password"}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={
                  isEditing ? "Leave empty to keep current" : "Enter password"
                }
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>

            {formData.password && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Roles</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select roles to assign. Privileges are defined at the role
                level.
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {formData.selectedRoles.length > 0
                      ? `${formData.selectedRoles.length} role(s) selected`
                      : "Select roles..."}
                    <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[300px]">
                  <DropdownMenuLabel>Available Roles</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {roles.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No roles available. Create roles first.
                    </div>
                  ) : (
                    roles.map((role) => (
                      <DropdownMenuCheckboxItem
                        key={role.name}
                        checked={formData.selectedRoles.includes(role.name)}
                        onCheckedChange={() => toggleRole(role.name)}
                      >
                        <Shield className="w-3.5 h-3.5 mr-2" />
                        {role.name}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {formData.selectedRoles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.selectedRoles.map((role) => (
                    <Badge key={role} variant="secondary" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {isEditing ? "Saving..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
