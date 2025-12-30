"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  Users,
  Shield,
  RefreshCw,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Database,
  Eye,
  Lock,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  FEATURE_ROLES,
  DATA_PRIVILEGES,
  getFeatureRole,
  isRestrictedDatabase,
  isFeatureRole,
  type DataPrivilege,
  type DataPrivilegeType,
} from "@/lib/rbac";
import type { SystemRole } from "@/lib/clickhouse";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface RoleWithPrivileges extends SystemRole {
  isFeatureRole: boolean;
  featureRoleInfo?: {
    name: string;
    description: string;
    details: string;
  };
  inheritedRoles?: string[];
  dataPrivileges?: DataPrivilege[];
}

interface DatabaseInfo {
  name: string;
}

interface TableInfo {
  database: string;
  name: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleWithPrivileges[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Database/table cache
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);

  // Create/Edit role dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    inheritedRoles: [] as string[],
    dataPrivileges: [] as DataPrivilege[],
  });

  // New data privilege form
  const [newDataPriv, setNewDataPriv] = useState({
    database: "*",
    table: "*",
    privileges: [] as DataPrivilegeType[],
  });

  // Table search popover
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false);

  // Current viewing role (for view mode)
  const [viewingRole, setViewingRole] = useState<RoleWithPrivileges | null>(
    null
  );

  // Delete role
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/clickhouse/access/roles");
      const data = await response.json();

      if (data.success) {
        setRoles(data.data || []);
      } else {
        setError(data.error || "Failed to fetch roles");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch databases and tables once for dropdowns
  const fetchSchema = useCallback(async () => {
    if (databases.length > 0) return; // Already loaded

    setLoadingSchema(true);
    try {
      // Fetch databases
      const dbResponse = await fetch("/api/clickhouse/databases");
      const dbData = await dbResponse.json();
      if (dbData.success && dbData.data) {
        // Filter out restricted databases
        const filteredDbs = dbData.data.filter(
          (db: DatabaseInfo) => !isRestrictedDatabase(db.name)
        );
        setDatabases(filteredDbs);

        // Fetch tables for all databases in parallel
        const allTables: TableInfo[] = [];
        const tablePromises = filteredDbs.map(async (db: DatabaseInfo) => {
          try {
            const tablesResponse = await fetch(
              `/api/clickhouse/tables?database=${encodeURIComponent(db.name)}`
            );
            const tablesData = await tablesResponse.json();
            if (tablesData.success && tablesData.data) {
              return tablesData.data.map((t: { name: string }) => ({
                database: db.name,
                name: t.name,
              }));
            }
          } catch {
            // Ignore individual database errors
          }
          return [];
        });

        const results = await Promise.all(tablePromises);
        for (const tables of results) {
          allTables.push(...tables);
        }
        setTables(allTables);
      }
    } catch (err) {
      console.error("Failed to fetch schema:", err);
    } finally {
      setLoadingSchema(false);
    }
  }, [databases.length]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Get all available roles for inheritance (both feature roles and user roles)
  const availableRolesForInheritance = useMemo(() => {
    return roles.map((r) => ({
      id: r.name,
      name: r.featureRoleInfo?.name || r.name,
      description: r.featureRoleInfo?.description || "",
      isFeatureRole: r.isFeatureRole,
    }));
  }, [roles]);

  const openCreateDialog = () => {
    setIsEditing(false);
    setIsViewing(false);
    setViewingRole(null);
    setFormData({
      name: "",
      inheritedRoles: [],
      dataPrivileges: [],
    });
    setNewDataPriv({ database: "*", table: "*", privileges: [] });
    setDialogError(null);
    setDialogOpen(true);
    fetchSchema();
  };

  const openEditDialog = (role: RoleWithPrivileges) => {
    setIsEditing(true);
    setIsViewing(false);
    setViewingRole(null);
    setFormData({
      name: role.name,
      inheritedRoles: role.inheritedRoles || [],
      dataPrivileges: role.dataPrivileges || [],
    });
    setNewDataPriv({ database: "*", table: "*", privileges: [] });
    setDialogError(null);
    setDialogOpen(true);
    fetchSchema();
  };

  const openViewDialog = (role: RoleWithPrivileges) => {
    setIsEditing(false);
    setIsViewing(true);
    setViewingRole(role);
    setFormData({
      name: role.name,
      inheritedRoles: role.inheritedRoles || [],
      dataPrivileges: role.dataPrivileges || [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setDialogError(null);

    if (!isEditing && !formData.name.trim()) {
      setDialogError("Role name is required");
      return;
    }

    setSaving(true);

    try {
      const endpoint = "/api/clickhouse/access/roles";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          inheritedRoles: formData.inheritedRoles,
          dataPrivileges: formData.dataPrivileges,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDialogOpen(false);
        fetchRoles();
      } else {
        setDialogError(
          data.error || `Failed to ${isEditing ? "update" : "create"} role`
        );
      }
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roleName: string) => {
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

  const toggleInheritedRole = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      inheritedRoles: prev.inheritedRoles.includes(roleId)
        ? prev.inheritedRoles.filter((r) => r !== roleId)
        : [...prev.inheritedRoles, roleId],
    }));
  };

  const toggleDataPrivilege = (priv: DataPrivilegeType) => {
    setNewDataPriv((prev) => ({
      ...prev,
      privileges: prev.privileges.includes(priv)
        ? prev.privileges.filter((p) => p !== priv)
        : [...prev.privileges, priv],
    }));
  };

  const addDataPrivilege = () => {
    if (newDataPriv.privileges.length === 0) return;

    // Validate not restricted database
    if (
      newDataPriv.database !== "*" &&
      isRestrictedDatabase(newDataPriv.database)
    ) {
      setDialogError(
        `Cannot grant privileges on '${newDataPriv.database}' database`
      );
      return;
    }

    setFormData((prev) => ({
      ...prev,
      dataPrivileges: [
        ...prev.dataPrivileges,
        {
          database: newDataPriv.database || "*",
          table: newDataPriv.table || "*",
          privileges: [...newDataPriv.privileges],
        },
      ],
    }));

    setNewDataPriv({ database: "*", table: "*", privileges: [] });
  };

  const removeDataPrivilege = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      dataPrivileges: prev.dataPrivileges.filter((_, i) => i !== index),
    }));
  };

  // Get tables filtered by selected database
  const filteredTables = useMemo(() => {
    if (newDataPriv.database === "*") return tables;
    return tables.filter((t) => t.database === newDataPriv.database);
  }, [newDataPriv.database, tables]);

  // Feature roles and user roles
  const featureRoles = roles.filter((r) => r.isFeatureRole);
  const userRoles = roles.filter((r) => !r.isFeatureRole);

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
          </TabsList>
        </Tabs>
      </Header>

      <div className="flex-1 p-6 space-y-6">
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
          <>
            {/* Feature Roles Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Feature Roles</h2>
                <Badge variant="secondary" className="text-xs">
                  {featureRoles.length} roles
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                System-managed roles that enable UI features. View only.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {featureRoles.map((role) => (
                  <Card
                    key={role.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => openViewDialog(role)}
                  >
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-primary" />
                          {role.featureRoleInfo?.name || role.name}
                        </span>
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {role.featureRoleInfo?.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            <Separator />

            {/* User Roles Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Custom Roles</h2>
                  <p className="text-sm text-muted-foreground">
                    {userRoles.length} role{userRoles.length !== 1 ? "s" : ""} •
                    Inherit from feature roles and have data privileges
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={openCreateDialog}>
                    <Plus className="w-4 h-4 mr-1" />
                    Create Role
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchRoles}
                    disabled={loading}
                  >
                    <RefreshCw
                      className={`w-4 h-4 mr-1 ${
                        loading ? "animate-spin" : ""
                      }`}
                    />
                    Refresh
                  </Button>
                </div>
              </div>

              <Card>
                <ScrollArea className="h-[calc(100vh-480px)]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-[180px]">Role Name</TableHead>
                        <TableHead>Inherited Roles</TableHead>
                        <TableHead>Data Access</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userRoles.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground py-8"
                          >
                            No custom roles yet. Create one to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        userRoles.map((role) => (
                          <TableRow key={role.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-muted-foreground" />
                                {role.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              {role.inheritedRoles &&
                              role.inheritedRoles.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {role.inheritedRoles.map((ir) => {
                                    const frInfo = getFeatureRole(ir);
                                    return (
                                      <Badge
                                        key={ir}
                                        variant={
                                          isFeatureRole(ir)
                                            ? "default"
                                            : "outline"
                                        }
                                        className="text-xs"
                                      >
                                        {frInfo?.name || ir}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  None
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {role.dataPrivileges &&
                              role.dataPrivileges.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {role.dataPrivileges
                                    .slice(0, 2)
                                    .map((dp, i) => (
                                      <Badge
                                        key={i}
                                        variant="secondary"
                                        className="text-xs font-mono"
                                      >
                                        {dp.privileges.join(",")} on{" "}
                                        {dp.database}.{dp.table}
                                      </Badge>
                                    ))}
                                  {role.dataPrivileges.length > 2 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      +{role.dataPrivileges.length - 2} more
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  None
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditDialog(role)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
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
                                        <strong>{role.name}</strong>?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => handleDelete(role.name)}
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
                </ScrollArea>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Create/Edit/View Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isViewing
                ? viewingRole?.featureRoleInfo?.name || viewingRole?.name
                : isEditing
                ? "Edit Role"
                : "Create Role"}
            </DialogTitle>
            <DialogDescription>
              {isViewing
                ? viewingRole?.featureRoleInfo?.description
                : isEditing
                ? "Update role inheritance and data privileges."
                : "Create a new role with inherited roles and data access."}
            </DialogDescription>
          </DialogHeader>

          {isViewing && viewingRole ? (
            // View mode for feature roles
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm">
                  {viewingRole.featureRoleInfo?.details}
                </p>
              </div>
              <div>
                <Label className="text-base">Role Name</Label>
                <p className="text-sm font-mono text-muted-foreground mt-1">
                  {viewingRole.name}
                </p>
              </div>
            </div>
          ) : (
            // Edit/Create mode
            <div className="space-y-6 py-4">
              {dialogError && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {dialogError}
                </div>
              )}

              {!isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="name">Role Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g. analyst_role"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
              )}

              {/* Inherited Roles */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base">Inherited Roles</Label>
                  <p className="text-xs text-muted-foreground">
                    Select roles to inherit privileges from.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                  {availableRolesForInheritance
                    .filter((r) => r.id !== formData.name)
                    .map((role) => (
                      <div
                        key={role.id}
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm",
                          formData.inheritedRoles.includes(role.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/50"
                        )}
                        onClick={() => toggleInheritedRole(role.id)}
                      >
                        <Checkbox
                          checked={formData.inheritedRoles.includes(role.id)}
                          onCheckedChange={() => toggleInheritedRole(role.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium flex items-center gap-1">
                            {role.name}
                            {role.isFeatureRole && (
                              <Lock className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                          {role.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {role.description}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <Separator />

              {/* Data Privileges */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base">Data Privileges</Label>
                  <p className="text-xs text-muted-foreground">
                    Grant access to specific databases and tables.
                  </p>
                </div>

                {/* Existing data privileges */}
                {formData.dataPrivileges.length > 0 && (
                  <div className="space-y-2">
                    {formData.dataPrivileges.map((dp, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono text-sm">
                            {dp.privileges.join(", ")} on {dp.database}.
                            {dp.table}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDataPrivilege(index)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new data privilege */}
                <div className="p-3 rounded-lg border border-dashed space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Database</Label>
                      <Select
                        value={newDataPriv.database}
                        onValueChange={(value) =>
                          setNewDataPriv({
                            ...newDataPriv,
                            database: value,
                            table: "*",
                          })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select database" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="*">* (all databases)</SelectItem>
                          {loadingSchema ? (
                            <SelectItem value="_loading" disabled>
                              Loading...
                            </SelectItem>
                          ) : (
                            databases.map((db) => (
                              <SelectItem key={db.name} value={db.name}>
                                {db.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Table</Label>
                      <Popover
                        open={tablePopoverOpen}
                        onOpenChange={setTablePopoverOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="h-9 w-full justify-between font-normal"
                          >
                            {newDataPriv.table === "*"
                              ? "* (all tables)"
                              : newDataPriv.table}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search tables..." />
                            <CommandList>
                              <CommandEmpty>No tables found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="all-tables"
                                  keywords={["all", "tables", "*"]}
                                  onSelect={() => {
                                    setNewDataPriv({
                                      ...newDataPriv,
                                      table: "*",
                                    });
                                    setTablePopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      newDataPriv.table === "*"
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  * (all tables)
                                </CommandItem>
                                {filteredTables.map((t) => (
                                  <CommandItem
                                    key={`${t.database}.${t.name}`}
                                    value={`${t.database}-${t.name}`}
                                    keywords={[t.name, t.database]}
                                    onSelect={() => {
                                      setNewDataPriv({
                                        ...newDataPriv,
                                        table: t.name,
                                      });
                                      setTablePopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        newDataPriv.table === t.name
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {t.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DATA_PRIVILEGES.map((priv) => (
                      <Badge
                        key={priv.id}
                        variant={
                          newDataPriv.privileges.includes(priv.id)
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleDataPrivilege(priv.id)}
                      >
                        {priv.name}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={addDataPrivilege}
                    disabled={newDataPriv.privileges.length === 0}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Data Access
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {isViewing ? (
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Close
              </Button>
            ) : (
              <>
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
                    "Create Role"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
