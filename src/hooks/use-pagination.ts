import * as React from "react";

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  total: number;
}

interface UsePaginationReturn {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  goToPage: (page: number) => void;
}

function usePagination({
  initialPage = 1,
  initialPageSize = 10,
  total,
}: UsePaginationOptions): UsePaginationReturn {
  const [page, setPage] = React.useState(initialPage);
  const [pageSize, setPageSizeState] = React.useState(initialPageSize);

  const totalPages = React.useMemo(
    () => Math.ceil(total / pageSize),
    [total, pageSize]
  );

  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  const setPageSize = React.useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const nextPage = React.useCallback(() => {
    setPage((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const previousPage = React.useCallback(() => {
    setPage((p) => Math.max(p - 1, 1));
  }, []);

  const firstPage = React.useCallback(() => {
    setPage(1);
  }, []);

  const lastPage = React.useCallback(() => {
    setPage(totalPages);
  }, [totalPages]);

  const goToPage = React.useCallback(
    (targetPage: number) => {
      setPage(Math.max(1, Math.min(targetPage, totalPages)));
    },
    [totalPages]
  );

  React.useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return {
    page,
    pageSize,
    totalPages,
    total,
    hasNextPage,
    hasPreviousPage,
    setPage,
    setPageSize,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    goToPage,
  };
}

export { usePagination };
