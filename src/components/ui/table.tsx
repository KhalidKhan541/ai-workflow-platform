import * as React from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string | React.ReactNode;
  sortable?: boolean;
  className?: string;
  cellClassName?: string;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: "left" | "center" | "right";
}

interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  sortable?: boolean;
  defaultSort?: SortConfig;
  onSort?: (sort: SortConfig) => void;
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedRows: string[]) => void;
  rowKey: keyof T | ((row: T) => string);
  emptyMessage?: string;
  className?: string;
  tableClassName?: string;
  headerClassName?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
  loading?: boolean;
}

function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  sortable = false,
  defaultSort,
  onSort,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  rowKey,
  emptyMessage = "No data available",
  className,
  tableClassName,
  headerClassName,
  rowClassName,
  onRowClick,
  pagination,
  loading = false,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<SortConfig | undefined>(defaultSort);

  const getRowKey = (row: T): string => {
    if (typeof rowKey === "function") return rowKey(row);
    return String(row[rowKey]);
  };

  const handleSort = (key: string) => {
    if (!sortable) return;
    const newSort: SortConfig = {
      key,
      direction: sort?.key === key && sort.direction === "asc" ? "desc" : "asc",
    };
    setSort(newSort);
    onSort?.(newSort);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange?.(data.map((row) => getRowKey(row)));
    } else {
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (key: string, checked: boolean) => {
    if (checked) {
      onSelectionChange?.([...selectedRows, key]);
    } else {
      onSelectionChange?.(selectedRows.filter((r) => r !== key));
    }
  };

  const allSelected = data.length > 0 && data.every((row) => selectedRows.includes(getRowKey(row)));
  const someSelected = selectedRows.length > 0 && !allSelected;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative overflow-auto rounded-md border scrollbar-thin">
        <table className={cn("w-full caption-bottom text-sm", tableClassName)}>
          <thead className={cn("[&_tr]:border-b", headerClassName)}>
            <tr>
              {selectable && (
                <th className="h-10 w-10 px-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-primary accent-primary"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "h-10 px-4 text-left font-medium text-muted-foreground",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                    sortable && "cursor-pointer hover:text-foreground select-none",
                    col.className
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {sortable && col.sortable !== false && sort?.key === col.key && (
                      <span className="text-xs">{sort.direction === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  {columns.map((col) => (
                    <td key={col.key} className="p-4">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => {
                const key = getRowKey(row);
                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/50",
                      selectedRows.includes(key) && "bg-muted/50",
                      onRowClick && "cursor-pointer",
                      typeof rowClassName === "function"
                        ? rowClassName(row, rowIndex)
                        : rowClassName
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(key)}
                          onChange={(e) => handleSelectRow(key, e.target.checked)}
                          className="h-4 w-4 rounded border-primary accent-primary"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-3",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right",
                          col.cellClassName
                        )}
                      >
                        {col.render
                          ? col.render(row[col.key], row, rowIndex)
                          : String(row[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {pagination && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} results
          </div>
          <div className="flex items-center gap-2">
            {pagination.onPageSizeChange && (
              <select
                value={pagination.pageSize}
                onChange={(e) => pagination.onPageSizeChange?.(Number(e.target.value))}
                className="h-8 rounded border bg-background px-2 text-sm"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-1">
              <button
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded border bg-background text-sm disabled:opacity-50"
              >
                ←
              </button>
              <span className="inline-flex h-8 items-center px-3 text-sm font-medium">
                {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize)}
              </span>
              <button
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border bg-background text-sm disabled:opacity-50"
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { DataTable, type Column, type SortConfig };
