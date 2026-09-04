import * as React from "react";
import { cn } from "@/lib/utils";
import { DataTable, Column, SortConfig } from "@/components/ui/table";
import { Input, NumberInput } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, Download, Upload, Trash2 } from "lucide-react";
import { Pagination, PageSizeSelector } from "@/components/ui/pagination";

interface FilterConfig {
  key: string;
  label: string;
  type: "text" | "select" | "number" | "date" | "boolean";
  options?: { label: string; value: string }[];
  placeholder?: string;
}

interface AdvancedDataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  rowKey: keyof T | ((row: T) => string);
  title?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: string[];
  filters?: FilterConfig[];
  filterValues?: Record<string, unknown>;
  onFilterChange?: (key: string, value: unknown) => void;
  sortable?: boolean;
  defaultSort?: SortConfig;
  onSort?: (sort: SortConfig) => void;
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedRows: string[]) => void;
  bulkActions?: { label: string; icon?: React.ReactNode; onClick: (selected: string[]) => void; destructive?: boolean }[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
  loading?: boolean;
  emptyMessage?: string;
  exportable?: boolean;
  onExport?: () => void;
  className?: string;
}

function AdvancedDataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  title,
  searchable = true,
  searchPlaceholder = "Search...",
  searchFields,
  filters = [],
  filterValues = {},
  onFilterChange,
  sortable = true,
  defaultSort,
  onSort,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  bulkActions = [],
  pagination,
  loading,
  emptyMessage,
  exportable = false,
  onExport,
  className,
}: AdvancedDataTableProps<T>) {
  const [search, setSearch] = React.useState("");
  const [showFilters, setShowFilters] = React.useState(false);

  const filteredData = React.useMemo(() => {
    let result = data;

    if (search && searchFields) {
      const searchLower = search.toLowerCase();
      result = result.filter((row) =>
        searchFields.some((field) => {
          const value = row[field];
          return value && String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    Object.entries(filterValues).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== null) {
        result = result.filter((row) => {
          const rowValue = row[key];
          if (typeof value === "string") {
            return String(rowValue).toLowerCase().includes(value.toLowerCase());
          }
          return rowValue === value;
        });
      }
    });

    return result;
  }, [data, search, searchFields, filterValues]);

  const activeFilterCount = Object.values(filterValues).filter(
    (v) => v !== undefined && v !== "" && v !== null
  ).length;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {selectedRows.length > 0 && (
            <Badge variant="secondary">{selectedRows.length} selected</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {exportable && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {searchable && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        )}
        {filters.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      {showFilters && filters.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 rounded-lg border bg-muted/30">
          {filters.map((filter) => (
            <div key={filter.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{filter.label}</label>
              {filter.type === "text" && (
                <Input
                  placeholder={filter.placeholder || "Filter..."}
                  value={String(filterValues[filter.key] || "")}
                  onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                  className="h-8 w-40 text-xs"
                />
              )}
              {filter.type === "select" && filter.options && (
                <Select
                  value={String(filterValues[filter.key] || "")}
                  onValueChange={(value) => onFilterChange?.(filter.key, value || null)}
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder={filter.placeholder || "All"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {filter.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {filter.type === "number" && (
                <NumberInput
                  placeholder={filter.placeholder || "0"}
                  value={String(filterValues[filter.key] || "")}
                  onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                  className="h-8 w-32 text-xs"
                />
              )}
            </div>
          ))}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                Object.keys(filterValues).forEach((key) => onFilterChange?.(key, null));
              }}
              className="text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {selectable && selectedRows.length > 0 && bulkActions.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
          <span className="text-sm text-muted-foreground">
            {selectedRows.length} rows selected
          </span>
          <div className="flex gap-1">
            {bulkActions.map((action, i) => (
              <Button
                key={i}
                variant={action.destructive ? "destructive" : "outline"}
                size="sm"
                onClick={() => action.onClick(selectedRows)}
              >
                {action.icon && <span className="mr-1">{action.icon}</span>}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredData}
        rowKey={rowKey}
        sortable={sortable}
        defaultSort={defaultSort}
        onSort={onSort}
        selectable={selectable}
        selectedRows={selectedRows}
        onSelectionChange={onSelectionChange}
        pagination={pagination}
        loading={loading}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}

export { AdvancedDataTable, type FilterConfig };
