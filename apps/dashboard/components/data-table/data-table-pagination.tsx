"use client";

import { Button } from "@/components/ui/button";

interface DataTablePaginationProps {
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange?: (page: number) => void;
}

export function DataTablePagination({
  pageIndex,
  pageCount,
  pageSize,
  total,
  onPageChange,
}: DataTablePaginationProps) {
  const from = pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {from} to {to} of {total} results
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange?.(pageIndex - 1)}
          disabled={pageIndex <= 0}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange?.(pageIndex + 1)}
          disabled={pageIndex >= pageCount - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
