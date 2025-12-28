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
  User,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useAccessStore } from "@/lib/store/access";

const PAGE_SIZE = 25;

export default function UsersPage() {
  const { users, loading, error, fetchAll, refresh, invalidate } =
    useAccessStore();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    password: "",
    confirmPassword: "",
    defaultDatabase: "",
  });

  // Delete user
  const [deleting, setDeleting] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Pagination calculations
  const totalPages = Math.ceil(users.length / PAGE_SIZE);
  const paginatedUsers = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return users.slice(start, start + PAGE_SIZE);
  }, [users, currentPage]);

  // Reset to first page when users change
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [users.length, totalPages, currentPage]);

  const handleCreateUser = async () => {
    setCreateError(null);

    if (!newUser.name.trim()) {
      setCreateError("Username is required");
      return;
    }

    if (newUser.password && newUser.password !== newUser.confirmPassword) {
      setCreateError("Passwords do not match");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/clickhouse/access/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUser.name.trim(),
          password: newUser.password || undefined,
          authType: newUser.password ? "sha256_password" : "no_password",
          defaultDatabase: newUser.defaultDatabase || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCreateOpen(false);
        setNewUser({
          name: "",
          password: "",
          confirmPassword: "",
          defaultDatabase: "",
        });
        invalidate();
        fetchAll();
      } else {
        setCreateError(data.error || "Failed to create user");
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userName: string) => {
    setDeleting(userName);

    try {
      const response = await fetch("/api/clickhouse/access/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: userName }),
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
      </Header>

      <div className="flex-1 p-6">
        {loading && users.length === 0 ? (
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
                Make sure you have SELECT permission on system.users.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Users</h2>
                <p className="text-sm text-muted-foreground">
                  {users.length} user{users.length !== 1 ? "s" : ""} found
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Create User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create User</DialogTitle>
                      <DialogDescription>
                        Create a new ClickHouse user. Leave password empty for
                        passwordless auth.
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
                        <Label htmlFor="name">Username *</Label>
                        <Input
                          id="name"
                          placeholder="e.g. analyst"
                          value={newUser.name}
                          onChange={(e) =>
                            setNewUser({ ...newUser, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Leave empty for no password"
                          value={newUser.password}
                          onChange={(e) =>
                            setNewUser({ ...newUser, password: e.target.value })
                          }
                        />
                      </div>
                      {newUser.password && (
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">
                            Confirm Password
                          </Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Confirm password"
                            value={newUser.confirmPassword}
                            onChange={(e) =>
                              setNewUser({
                                ...newUser,
                                confirmPassword: e.target.value,
                              })
                            }
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="defaultDatabase">
                          Default Database
                        </Label>
                        <Input
                          id="defaultDatabase"
                          placeholder="e.g. default"
                          value={newUser.defaultDatabase}
                          onChange={(e) =>
                            setNewUser({
                              ...newUser,
                              defaultDatabase: e.target.value,
                            })
                          }
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
                      <Button onClick={handleCreateUser} disabled={creating}>
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create User"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={refresh}
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
              <ScrollArea className="h-[calc(100vh-320px)]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[200px]">Name</TableHead>
                      <TableHead>Auth Type</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Default Database</TableHead>
                      <TableHead>Default Roles</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user) => (
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
                                .slice(0, 2)
                                .map((role) => (
                                  <Badge
                                    key={role}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {role}
                                  </Badge>
                                ))}
                              {user.default_roles_list.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{user.default_roles_list.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell>
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
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete user{" "}
                                  <strong>{user.name}</strong>? This action
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDeleteUser(user.name)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                  <span className="text-muted-foreground">
                    {users.length} users
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={currentPage + 1}
                        onChange={(e) => {
                          const page = parseInt(e.target.value, 10);
                          if (page >= 1 && page <= totalPages) {
                            setCurrentPage(page - 1);
                          }
                        }}
                        className="w-14 h-8 text-center text-sm"
                      />
                      <span className="text-muted-foreground">of {totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={currentPage >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
