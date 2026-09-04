import * as React from "react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  showFirstLast?: boolean;
  showPrevNext?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function Pagination({
  page,
  totalPages,
  onPageChange,
  siblingCount = 1,
  showFirstLast = true,
  showPrevNext = true,
  size = "md",
  className,
}: PaginationProps) {
  const getPageNumbers = React.useMemo(() => {
    const totalNumbers = siblingCount * 2 + 5;
    if (totalPages <= totalNumbers) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(page - siblingCount, 1);
    const rightSiblingIndex = Math.min(page + siblingCount, totalPages);

    const showLeftDots = leftSiblingIndex > 2;
    const showRightDots = rightSiblingIndex < totalPages - 1;

    if (!showLeftDots && showRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, "...", totalPages];
    }

    if (showLeftDots && !showRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + i + 1);
      return [1, "...", ...rightRange];
    }

    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    );
    return [1, "...", ...middleRange, "...", totalPages];
  }, [page, totalPages, siblingCount]);

  const sizeClasses = {
    sm: "h-8 min-w-8 text-xs",
    md: "h-10 min-w-10 text-sm",
    lg: "h-12 min-w-12 text-base",
  };

  return (
    <nav className={cn("flex items-center gap-1", className)} role="navigation" aria-label="Pagination">
      {showFirstLast && (
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className={cn(
            "inline-flex items-center justify-center rounded-md border bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none px-3",
            sizeClasses[size]
          )}
          aria-label="First page"
        >
          ««
        </button>
      )}
      {showPrevNext && (
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={cn(
            "inline-flex items-center justify-center rounded-md border bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none px-3",
            sizeClasses[size]
          )}
          aria-label="Previous page"
        >
          «
        </button>
      )}
      {getPageNumbers.map((pageNum, index) => {
        if (pageNum === "...") {
          return (
            <span
              key={`ellipsis-${index}`}
              className={cn(
                "inline-flex items-center justify-center text-muted-foreground",
                sizeClasses[size]
              )}
            >
              ...
            </span>
          );
        }
        return (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum as number)}
            className={cn(
              "inline-flex items-center justify-center rounded-md border text-sm font-medium transition-colors",
              sizeClasses[size],
              page === pageNum
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent hover:text-accent-foreground"
            )}
            aria-label={`Page ${pageNum}`}
            aria-current={page === pageNum ? "page" : undefined}
          >
            {pageNum}
          </button>
        );
      })}
      {showPrevNext && (
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={cn(
            "inline-flex items-center justify-center rounded-md border bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none px-3",
            sizeClasses[size]
          )}
          aria-label="Next page"
        >
          »
        </button>
      )}
      {showFirstLast && (
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className={cn(
            "inline-flex items-center justify-center rounded-md border bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none px-3",
            sizeClasses[size]
          )}
          aria-label="Last page"
        >
          »»
        </button>
      )}
    </nav>
  );
}

interface PageSizeSelectorProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  options?: number[];
  className?: string;
}

function PageSizeSelector({
  pageSize,
  onPageSizeChange,
  options = [10, 20, 50, 100],
  className,
}: PageSizeSelectorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">Show</span>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span className="text-sm text-muted-foreground">per page</span>
    </div>
  );
}

export { Pagination, PageSizeSelector };
