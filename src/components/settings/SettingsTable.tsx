"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHeader,
  TableRow,
  ClickableTableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Edit2, Loader2 } from "lucide-react";
import { useSettings, ClickHouseSetting } from "@/lib/hooks/use-settings";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PaginationControls } from "@/components/monitoring/pagination-controls";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import { useToast } from "@/components/ui/use-toast";

const DEFAULT_PAGE_SIZE = 50;

interface SettingsTableProps {
  scope?: "session" | "server";
  readOnly?: boolean;
}

export function SettingsTable({
  scope = "session",
  readOnly = false,
}: SettingsTableProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { settings, isLoading, updateSetting } = useSettings(
    debouncedSearch,
    scope
  );

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<keyof ClickHouseSetting>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    "asc"
  );

  // Editing state
  const [editingSetting, setEditingSetting] =
    useState<ClickHouseSetting | null>(null);
  const [newValue, setNewValue] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Error state for edit modal
  const [editError, setEditError] = useState<string | null>(null);

  // Toast notifications
  const { toast } = useToast();

  // Handle search with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  // Effect to debounce search would be better, but for now let's just use onBlur or Enter
  // functionality. Or just simple timeout.
  // Actually, let's just update debouncedSearch on key press with timeout
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setDebouncedSearch(search);
      setPage(1);
    }
  };

  const handleBlur = () => {
    setDebouncedSearch(search);
    setPage(1);
  };

  const sortedSettings = useMemo(() => {
    return [...settings].sort((a, b) => {
      if (!sortColumn || !sortDirection) return 0;

      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [settings, sortColumn, sortDirection]);

  const paginatedSettings = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedSettings.slice(start, start + pageSize);
  }, [sortedSettings, page, pageSize]);

  const totalPages = Math.ceil(settings.length / pageSize);

  const updateSort = (
    column: keyof ClickHouseSetting,
    direction: "asc" | "desc" | null
  ) => {
    setSortColumn(column);
    setSortDirection(direction);
  };

  const openEditDialog = (setting: ClickHouseSetting) => {
    setEditingSetting(setting);
    setNewValue(setting.value);
    setEditError(null); // Clear any previous error
  };

  const handleUpdate = async () => {
    if (!editingSetting) return;

    try {
      setIsUpdating(true);
      setEditError(null);
      await updateSetting(editingSetting.name, newValue);
      toast({
        title: "Setting updated",
        description: `Setting ${editingSetting.name} has been updated.`,
      });
      setEditingSetting(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update setting";
      setEditError(message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${scope} settings...`}
            value={search}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="pl-8"
          />
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="border-none bg-muted/50">
            {settings.length} settings
          </Badge>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden border-none shadow-none flex flex-col">
        <div className="flex-1 border rounded-md overflow-auto relative">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  currentSort={sortColumn === "name" ? sortDirection : null}
                  onSort={(dir) => updateSort("name", dir)}
                  className="w-[300px]"
                >
                  Name
                </SortableTableHead>
                <SortableTableHead
                  currentSort={sortColumn === "value" ? sortDirection : null}
                  onSort={(dir) => updateSort("value", dir)}
                  className="w-[200px]"
                >
                  Value
                </SortableTableHead>
                {scope === "server" && (
                  <SortableTableHead
                    currentSort={
                      sortColumn === "default" ? sortDirection : null
                    }
                    onSort={(dir) => updateSort("default", dir)}
                    className="w-[200px]"
                  >
                    Default
                  </SortableTableHead>
                )}
                <SortableTableHead
                  currentSort={sortColumn === "type" ? sortDirection : null}
                  onSort={(dir) => updateSort("type", dir)}
                  className="w-[150px]"
                >
                  Type
                </SortableTableHead>
                <SortableTableHead
                  currentSort={sortColumn === "changed" ? sortDirection : null}
                  onSort={(dir) => updateSort("changed", dir)}
                  className="w-[100px]"
                >
                  Modified
                </SortableTableHead>
                {scope === "server" && (
                  <SortableTableHead
                    currentSort={
                      sortColumn === "is_hot_reloadable" ? sortDirection : null
                    }
                    onSort={(dir) => updateSort("is_hot_reloadable", dir)}
                    className="w-[100px]"
                  >
                    Hot Reload
                  </SortableTableHead>
                )}
                <SortableTableHead className="flex-1" sortable={false}>
                  Description
                </SortableTableHead>
                {!readOnly && scope === "session" && (
                  <SortableTableHead className="w-[100px]" sortable={false}>
                    Actions
                  </SortableTableHead>
                )}
                <SortableTableHead className="w-8" sortable={false} />
              </TableRow>
            </TableHeader>
            <TableBody isLoading={isLoading && settings.length === 0}>
              {isLoading && settings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={scope === "server" ? 8 : 7}
                    className="h-24 text-center"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSettings.map((setting) => (
                  <ClickableTableRow
                    key={setting.name}
                    record={setting}
                    columns={[
                      { name: "name", type: "String" },
                      { name: "value", type: "String" },
                      { name: "default", type: "String" },
                      { name: "type", type: "String" },
                      { name: "description", type: "String" },
                      { name: "min", type: "String" },
                      { name: "max", type: "String" },
                      { name: "readonly", type: "UInt8" },
                      { name: "is_hot_reloadable", type: "UInt8" },
                    ]}
                    rowIndex={0} // Index not critical for display but required by type? Checked: optional
                    sheetTitle="Setting Details"
                  >
                    <TableCell className="data-table-cell font-medium">
                      <TruncatedCell value={setting.name} maxWidth={250} />
                    </TableCell>
                    <TableCell className="data-table-cell max-w-[200px]">
                      <TruncatedCell value={setting.value} maxWidth={200} />
                    </TableCell>
                    {scope === "server" && (
                      <TableCell className="data-table-cell max-w-[200px] text-muted-foreground">
                        {setting.default ? (
                          <TruncatedCell
                            value={setting.default}
                            maxWidth={200}
                          />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    )}
                    <TableCell className="data-table-cell text-muted-foreground">
                      {setting.type}
                    </TableCell>
                    <TableCell className="data-table-cell">
                      {setting.changed === 1 && (
                        <Badge variant="secondary" className="text-xs">
                          Modified
                        </Badge>
                      )}
                    </TableCell>
                    {scope === "server" && (
                      <TableCell className="data-table-cell">
                        {setting.is_hot_reloadable === 1 ? (
                          <Badge
                            variant="outline"
                            className="text-xs border-green-200 text-green-700 bg-green-50"
                          >
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="data-table-cell text-muted-foreground max-w-[400px]">
                      <TruncatedCell
                        value={setting.description}
                        maxWidth={400}
                      />
                    </TableCell>
                    {!readOnly && scope === "session" && (
                      <TableCell className="data-table-cell">
                        {setting.readonly === 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(setting);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </ClickableTableRow>
                ))
              )}
              {!isLoading && settings.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={scope === "server" ? 8 : 7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No settings found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={settings.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>

      <Dialog
        open={!!editingSetting}
        onOpenChange={(open) => !open && setEditingSetting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Setting: {editingSetting?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="value" className="text-right">
                Value
              </Label>
              <Input
                id="value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="col-span-3 font-mono"
              />
            </div>
            {editingSetting?.min && (
              <div className="text-sm text-muted-foreground text-center">
                Min: {editingSetting.min}, Max: {editingSetting.max}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              {editingSetting?.description}
            </div>
            {editError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {editError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSetting(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DataSourceBadge
        sources={["system.settings"]}
        description={
          scope === "server"
            ? "Global server configuration."
            : "Settings for the current session. Changes affect only this session."
        }
      />
    </div>
  );
}
