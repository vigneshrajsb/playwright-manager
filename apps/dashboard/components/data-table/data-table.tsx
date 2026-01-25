"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  type Table as TanStackTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { DataTablePagination } from "./data-table-pagination";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  // Table meta for custom data passed to cells
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: any;
  // Server-side pagination
  pageCount?: number;
  pageIndex?: number;
  pageSize?: number;
  total?: number;
  onPaginationChange?: (pageIndex: number) => void;
  // Sorting
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  // Row selection
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  // Column visibility
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  // Row ID accessor
  getRowId?: (row: TData) => string;
  // Row click handler
  onRowClick?: (row: TData) => void;
  // Render toolbar with table instance
  toolbar?: (table: TanStackTable<TData>) => React.ReactNode;
  // Highlighted row ID (for visual selection without TanStack row selection)
  highlightedRowId?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  emptyMessage = "No results found",
  emptyIcon,
  meta,
  pageCount,
  pageIndex = 0,
  pageSize = 20,
  total,
  onPaginationChange,
  sorting,
  onSortingChange,
  enableRowSelection = false,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  onColumnVisibilityChange,
  getRowId,
  onRowClick,
  toolbar,
  highlightedRowId,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    meta,
    getCoreRowModel: getCoreRowModel(),
    // Manual pagination (server-side)
    manualPagination: true,
    pageCount: pageCount ?? -1,
    // Manual sorting (server-side)
    manualSorting: true,
    // State
    state: {
      sorting,
      rowSelection: rowSelection ?? {},
      columnVisibility,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    // Callbacks
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting ?? []) : updater;
      onSortingChange?.(newSorting);
    },
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === "function"
          ? updater(rowSelection ?? {})
          : updater;
      onRowSelectionChange?.(newSelection);
    },
    onColumnVisibilityChange: (updater) => {
      const newVisibility =
        typeof updater === "function"
          ? updater(columnVisibility ?? {})
          : updater;
      onColumnVisibilityChange?.(newVisibility);
    },
    enableRowSelection,
    getRowId,
  });

  return (
    <div className="space-y-4">
      {toolbar?.(table)}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      width:
                        header.column.columnDef.size !== 150
                          ? header.column.columnDef.size
                          : undefined,
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={(row.getIsSelected() || row.id === highlightedRowId) && "selected"}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-12">
                  <div className="text-center">
                    {emptyIcon}
                    <p className="text-sm font-medium text-muted-foreground mt-3">
                      {emptyMessage}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount != null && pageCount > 1 && (
        <DataTablePagination
          pageIndex={pageIndex}
          pageCount={pageCount}
          pageSize={pageSize}
          total={total ?? 0}
          onPageChange={onPaginationChange}
        />
      )}
    </div>
  );
}
