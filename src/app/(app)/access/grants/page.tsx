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
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { SystemGrant } from "@/lib/clickhouse";
import Link from "next/link";
import { useAccessStore } from "@/lib/store/access";

// Common access types in ClickHouse
const ACCESS_TYPES = [
  "SELECT",
  "INSERT",
  "ALTER",
  "CREATE",
  "DROP",
  "TRUNCATE",
  "OPTIMIZE",
  "SHOW",
  "KILL QUERY",
  "ACCESS MANAGEMENT",
  "ALL",
];

const PAGE_SIZE = 25;

export default function GrantsPage() {
  const { grants, loading, error, fetchAll, refresh, invalidate } =
    useAccessStore();

  const [filter, setFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

  // Grant dialog
  const [grantOpen, setGrantOpen] = useState(false);
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [newGrant, setNewGrant] = useState({
    accessType: "SELECT",
    database: "",
    table: "",
    granteeType: "user" as "user" | "role",
    granteeName: "",
  });

  // Revoke
  const [revoking, setRevoking] = useState<number | null>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Filtered grants
  const filteredGrants = useMemo(() => {
    if (!filter) return grants;
    const searchLower = filter.toLowerCase();
    return grants.filter(
      (grant) =>
        grant.user_name?.toLowerCase().includes(searchLower) ||
        grant.role_name?.toLowerCase().includes(searchLower) ||
        grant.access_type.toLowerCase().includes(searchLower) ||
        grant.database?.toLowerCase().includes(searchLower) ||
        grant.table?.toLowerCase().includes(searchLower)
    );
  }, [grants, filter]);

  // Pagination
  const totalPages = Math.ceil(filteredGrants.length / PAGE_SIZE);
  const paginatedGrants = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredGrants.slice(start, start + PAGE_SIZE);
  }, [filteredGrants, currentPage]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [filter]);

  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [filteredGrants.length, totalPages, currentPage]);

  const handleGrant = async () => {
    setGrantError(null);
    if (!newGrant.granteeName.trim()) {
      setGrantError("Grantee name is required");
      return;
    }

    setGranting(true);
    try {
      const response = await fetch("/api/clickhouse/access/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessType: newGrant.accessType,
          database: newGrant.database || undefined,
          table: newGrant.table || undefined,
          granteeType: newGrant.granteeType,
          granteeName: newGrant.granteeName.trim(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setGrantOpen(false);
        setNewGrant({
          accessType: "SELECT",
          database: "",
          table: "",
          granteeType: "user",
          granteeName: "",
        });
        invalidate();
        fetchAll();
      } else {
        setGrantError(data.error || "Failed to grant permission");
      }
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "Network error");
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async (grant: SystemGrant, index: number) => {
    setRevoking(index);
    try {
      const response = await fetch("/api/clickhouse/access/grants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessType: grant.access_type,
          database: grant.database || undefined,
          table: grant.table || undefined,
          granteeType: grant.user_name ? "user" : "role",
          granteeName: grant.user_name || grant.role_name,
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
      </Header>

      <div className="flex-1 p-6">
        {loading && grants.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Error Loading Grants
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
                <h2 className="text-xl font-semibold">Grants</h2>
                <p className="text-sm text-muted-foreground">
                  {grants.length} permission grant{grants.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Grant
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Grant Permission</DialogTitle>
                      <DialogDescription>
                        Grant access to a user or role.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {grantError && (
                        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {grantError}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Access Type *</Label>
                        <select
                          value={newGrant.accessType}
                          onChange={(e) =>
                            setNewGrant({ ...newGrant, accessType: e.target.value })
                          }
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          {ACCESS_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="database">Database</Label>
                          <Input
                            id="database"
                            placeholder="* (all)"
                            value={newGrant.database}
                            onChange={(e) =>
                              setNewGrant({ ...newGrant, database: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="table">Table</Label>
                          <Input
                            id="table"
                            placeholder="* (all)"
                            value={newGrant.table}
                            onChange={(e) =>
                              setNewGrant({ ...newGrant, table: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Grantee Type</Label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="granteeType"
                              checked={newGrant.granteeType === "user"}
                              onChange={() =>
                                setNewGrant({ ...newGrant, granteeType: "user" })
                              }
                              className="accent-primary"
                            />
                            <span className="text-sm">User</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="granteeType"
                              checked={newGrant.granteeType === "role"}
                              onChange={() =>
                                setNewGrant({ ...newGrant, granteeType: "role" })
                              }
                              className="accent-primary"
                            />
                            <span className="text-sm">Role</span>
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="granteeName">
                          {newGrant.granteeType === "user" ? "Username" : "Role Name"} *
                        </Label>
                        <Input
                          id="granteeName"
                          placeholder={
                            newGrant.granteeType === "user" ? "e.g. analyst" : "e.g. read_only"
                          }
                          value={newGrant.granteeName}
                          onChange={(e) =>
                            setNewGrant({ ...newGrant, granteeName: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setGrantOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleGrant} disabled={granting}>
                        {granting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Granting...
                          </>
                        ) : (
                          "Grant Permission"
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
              <ScrollArea className="h-[calc(100vh-360px)]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[150px]">Grantee</TableHead>
                      <TableHead className="w-[150px]">Access Type</TableHead>
                      <TableHead>Database</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedGrants.map((grant, index) => (
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
                            variant={grant.is_partial_revoke ? "destructive" : "outline"}
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
                            <Badge variant="secondary" className="text-xs">*</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {grant.table ? (
                            <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                              {grant.table}
                            </code>
                          ) : (
                            <Badge variant="secondary" className="text-xs">*</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                disabled={revoking === index}
                              >
                                {revoking === index ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke Permission</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Revoke <strong>{grant.access_type}</strong> from{" "}
                                  <strong>{grant.user_name || grant.role_name}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleRevoke(grant, index)}
                                >
                                  Revoke
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
                    Page {currentPage + 1} of {totalPages}
                    {filter && ` (${filteredGrants.length} filtered)`}
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

            {paginatedGrants.length === 0 && filter && (
              <div className="text-center py-8 text-muted-foreground">
                No grants match &quot;{filter}&quot;
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
