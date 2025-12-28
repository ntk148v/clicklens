"use client";

import { useEffect, useState, useMemo } from "react";
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
  UserPlus,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useAccessStore } from "@/lib/store/access";

const PAGE_SIZE = 25;

export default function RolesPage() {
  const { roles, roleGrants, users, loading, error, fetchAll, refresh, invalidate } =
    useAccessStore();

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);

  // Create role dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");

  // Delete role
  const [deleting, setDeleting] = useState<string | null>(null);

  // Assign role dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigningRole, setAssigningRole] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState("");

  // Revoke role
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Pagination
  const totalPages = Math.ceil(roles.length / PAGE_SIZE);
  const paginatedRoles = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return roles.slice(start, start + PAGE_SIZE);
  }, [roles, currentPage]);

  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [roles.length, totalPages, currentPage]);

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
        invalidate();
        fetchAll();
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
        invalidate();
        fetchAll();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handleAssignRole = async () => {
    if (!assigningRole || !selectedUser) {
      setAssignError("Please select a user");
      return;
    }

    setAssigning(true);
    setAssignError(null);

    try {
      const response = await fetch("/api/clickhouse/access/role-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleName: assigningRole,
          granteeType: "user",
          granteeName: selectedUser,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setAssignOpen(false);
        setAssigningRole(null);
        setSelectedUser("");
        invalidate();
        fetchAll();
      } else {
        setAssignError(data.error || "Failed to assign role");
      }
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Network error");
    } finally {
      setAssigning(false);
    }
  };

  const handleRevokeRole = async (roleName: string, userName: string) => {
    setRevoking(`${roleName}-${userName}`);
    try {
      const response = await fetch("/api/clickhouse/access/role-grants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleName,
          granteeType: "user",
          granteeName: userName,
        }),
      });
      const data = await response.json();
      if (data.success) {
        invalidate();
        fetchAll();
      }
    } catch (err) {
      console.error("Revoke failed:", err);
    } finally {
      setRevoking(null);
    }
  };

  const openAssignDialog = (roleName: string) => {
    setAssigningRole(roleName);
    setSelectedUser("");
    setAssignError(null);
    setAssignOpen(true);
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
        {loading && roles.length === 0 ? (
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
                        Create a new role. You can assign permissions after creating.
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
                      <Button variant="outline" onClick={() => setCreateOpen(false)}>
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

                <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            <Card>
              <ScrollArea className="h-[calc(100vh-320px)]">
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
                    {paginatedRoles.map((role) => {
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
                            <div className="flex flex-wrap items-center gap-1">
                              {assignees.length > 0 ? (
                                <>
                                  {assignees.slice(0, 3).map((a, i) => (
                                    <Badge
                                      key={i}
                                      variant={a.type === "user" ? "default" : "secondary"}
                                      className="text-xs group cursor-pointer hover:bg-destructive/80"
                                      onClick={() =>
                                        a.type === "user" && a.name && handleRevokeRole(role.name, a.name)
                                      }
                                      title={a.type === "user" ? "Click to revoke" : undefined}
                                    >
                                      {revoking === `${role.name}-${a.name}` ? (
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                      ) : (
                                        <>
                                          {a.type === "user" ? "👤" : "🛡️"} {a.name}
                                          {a.type === "user" && (
                                            <X className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100" />
                                          )}
                                        </>
                                      )}
                                    </Badge>
                                  ))}
                                  {assignees.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{assignees.length - 3}
                                    </Badge>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground text-xs">Not assigned</span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-1"
                                onClick={() => openAssignDialog(role.name)}
                                title="Assign to user"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                              </Button>
                            </div>
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
                                  <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete role <strong>{role.name}</strong>?
                                    This will remove it from all users.
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                  <span className="text-muted-foreground">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Assign Role Dialog */}
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Role to User</DialogTitle>
                  <DialogDescription>
                    Grant role <strong>{assigningRole}</strong> to a user.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {assignError && (
                    <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {assignError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="assignUser">Select User *</Label>
                    <select
                      id="assignUser"
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">Choose a user...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.name}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAssignOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAssignRole} disabled={assigning}>
                    {assigning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      "Assign Role"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}
