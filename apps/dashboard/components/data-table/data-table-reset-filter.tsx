"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DataTableResetFilterProps {
  filterKeys: string[];
  searchParams: URLSearchParams;
  updateUrl: (updates: Record<string, string | undefined>) => void;
}

export function DataTableResetFilter({
  filterKeys,
  searchParams,
  updateUrl,
}: DataTableResetFilterProps) {
  const hasActiveFilters = filterKeys.some((key) => searchParams.get(key));

  const resetFilters = () => {
    const updates = Object.fromEntries(
      filterKeys.map((k) => [k, undefined])
    ) as Record<string, undefined>;
    updateUrl(updates);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`h-8 w-8 ${!hasActiveFilters ? "invisible" : ""}`}
          onClick={resetFilters}
          disabled={!hasActiveFilters}
        >
          <X className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Reset filters</TooltipContent>
    </Tooltip>
  );
}
