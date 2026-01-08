"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Edit2, RotateCcw } from "lucide-react";
import { useSettings, ClickHouseSetting } from "@/lib/hooks/use-settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { PaginationControls } from "@/components/monitoring";

const DEFAULT_PAGE_SIZE = 50;

export function SettingsTable() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { settings, isLoading, updateSetting } = useSettings(debouncedSearch);

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

  // Handle search with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    // Simple debounce could be here, or just basic delay logic,
    // but for simplicity we rely on manual Enter or implicit local state filtering if list is small.
    // However, the hook takes a search param, so we should update debouncedSearch.
    // implementing a simple timeout for debounce
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
  };

  const handleUpdate = async () => {
    if (!editingSetting) return;

    try {
      setIsUpdating(true);
      await updateSetting(editingSetting.name, newValue);
      // toast.success(`Updated ${editingSetting.name}`);
      setEditingSetting(null);
    } catch (error) {
      // toast.error(error instanceof Error ? error.message : "Failed to update setting");
      console.error(error);
      alert(
        error instanceof Error ? error.message : "Failed to update setting"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search settings..."
            value={search}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="pl-8"
          />
        </div>
      </div>

      <TableWrapper>
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
              <SortableTableHead className="flex-1" sortable={false}>
                Description
              </SortableTableHead>
              <SortableTableHead className="w-[100px]" sortable={false}>
                Actions
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody isLoading={isLoading && settings.length === 0}>
            {/* Optimistic loading support or standard overlay */}
            {isLoading && settings.length === 0 ? (
              // Explicit empty state loaded by TableBody if handled, but TableBody expects children
              // We will let TableBody handle empty children with isLoading=true
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              paginatedSettings.map((setting) => (
                <TableRow key={setting.name}>
                  <TableCell
                    className="font-medium font-mono text-sm"
                    title={setting.name}
                  >
                    {setting.name}
                  </TableCell>
                  <TableCell
                    className="font-mono text-sm max-w-[200px] truncate"
                    title={setting.value}
                  >
                    {setting.value}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {setting.type}
                  </TableCell>
                  <TableCell>
                    {setting.changed === 1 && (
                      <Badge variant="secondary" className="text-xs">
                        Modified
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className="text-sm text-muted-foreground max-w-[400px] truncate"
                    title={setting.description}
                  >
                    {setting.description}
                  </TableCell>
                  <TableCell>
                    {setting.readonly === 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(setting)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
            {!isLoading && settings.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No settings found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableWrapper>

      <PaginationControls
        page={page}
        totalPages={totalPages}
        totalItems={settings.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <Dialog
        open={!!editingSetting}
        onOpenChange={(open) => !open && setEditingSetting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Setting</DialogTitle>
            <DialogDescription>
              Update value for{" "}
              <code className="text-primary">{editingSetting?.name}</code>. This
              will be applied to the current user.
            </DialogDescription>
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
              <div className="text-xs text-muted-foreground text-center">
                Min: {editingSetting.min}, Max: {editingSetting.max}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingSetting(null)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
