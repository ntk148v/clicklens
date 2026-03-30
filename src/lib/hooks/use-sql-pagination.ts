import { useState, useCallback } from "react";

export interface UseSqlPaginationOptions {
  activeTabId: string | null;
  onPageChange: (page: number, pageSize: number) => Promise<void>;
}

export interface UseSqlPaginationReturn {
  pagination: Record<string, { page: number; pageSize: number }>;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (size: number) => void;
  getCurrentPagination: () => { page: number; pageSize: number };
}

export function useSqlPagination({
  activeTabId,
  onPageChange,
}: UseSqlPaginationOptions): UseSqlPaginationReturn {
  const [pagination, setPagination] = useState<
    Record<string, { page: number; pageSize: number }>
  >({});

  const handlePageChange = useCallback(
    (page: number) => {
      const currentSize = pagination[activeTabId || ""]?.pageSize || 100;
      const newPage = page - 1;

      setPagination((prev) => ({
        ...prev,
        [activeTabId || ""]: { page: newPage, pageSize: currentSize },
      }));

      onPageChange(newPage, currentSize);
    },
    [onPageChange, pagination, activeTabId],
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPagination((prev) => ({
        ...prev,
        [activeTabId || ""]: { page: 0, pageSize: size },
      }));

      onPageChange(0, size);
    },
    [onPageChange, activeTabId],
  );

  const getCurrentPagination = useCallback(() => {
    return pagination[activeTabId || ""] || { page: 0, pageSize: 100 };
  }, [pagination, activeTabId]);

  return {
    pagination,
    handlePageChange,
    handlePageSizeChange,
    getCurrentPagination,
  };
}