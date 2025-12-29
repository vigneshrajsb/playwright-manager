"use client";

import { CheckIcon, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface FacetedFilterOption {
  label: string;
  value: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

interface DataTableFacetedFilterProps {
  title: string;
  options: FacetedFilterOption[];
  selectedValues: Set<string>;
  onSelectionChange: (values: Set<string>) => void;
}

export function DataTableFacetedFilter({
  title,
  options,
  selectedValues,
  onSelectionChange,
}: DataTableFacetedFilterProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {selectedValues.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal"
              >
                {selectedValues.size}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="max-h-[300px] overflow-auto p-1">
          {options.map((option) => {
            const isSelected = selectedValues.has(option.value);
            return (
              <div
                key={option.value}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                  isSelected && "bg-accent"
                )}
                onClick={() => {
                  const newSet = new Set(selectedValues);
                  if (isSelected) {
                    newSet.delete(option.value);
                  } else {
                    newSet.add(option.value);
                  }
                  onSelectionChange(newSet);
                }}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "opacity-50 [&_svg]:invisible"
                  )}
                >
                  <CheckIcon className="h-3 w-3" />
                </div>
                {option.icon && (
                  <option.icon className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="flex-1">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {option.count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {selectedValues.size > 0 && (
          <>
            <Separator />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-center"
              onClick={() => onSelectionChange(new Set())}
            >
              Clear filters
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
