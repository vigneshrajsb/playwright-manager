# Time Range Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Datadog-style time range picker with auto-refresh to pipelines and results tables.

**Architecture:** Client-side time parsing with React Query refetchInterval for auto-refresh. Time range stored in URL params, converted to startDate/endDate before API calls.

**Tech Stack:** React, React Query, shadcn/ui (Popover, Calendar), date-fns, TypeScript

---

## Task 1: Install Calendar Dependencies

**Files:**
- Modify: `apps/dashboard/package.json`

**Step 1: Install react-day-picker and date-fns**

Run:
```bash
cd apps/dashboard && pnpm add react-day-picker date-fns
```

Expected: Dependencies added to package.json

**Step 2: Verify installation**

Run:
```bash
cd apps/dashboard && pnpm list react-day-picker date-fns
```

Expected: Both packages listed

**Step 3: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/pnpm-lock.yaml ../../pnpm-lock.yaml
git commit -m "chore: add react-day-picker and date-fns dependencies"
```

---

## Task 2: Create Time Range Utility Functions

**Files:**
- Create: `apps/dashboard/lib/utils/time-range.ts`

**Step 1: Create time-range.ts with parsing and validation**

```typescript
import { subMinutes, subHours, subDays, subWeeks, startOfDay, endOfDay, format } from "date-fns";

export const TIME_PRESETS = [
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
] as const;

export const DEFAULT_TIME_RANGE = "24h";

export type TimeUnit = "m" | "h" | "d" | "w";

export interface ParsedTimeRange {
  value: number;
  unit: TimeUnit;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Sanitize raw user input
 */
export function sanitizeTimeInput(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Parse time range string like "15m" into components
 */
export function parseTimeRange(input: string): ParsedTimeRange | null {
  const sanitized = sanitizeTimeInput(input);
  const match = sanitized.match(/^(\d+)([mhdw])$/);

  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2] as TimeUnit;

  if (value <= 0 || value > 999) return null;

  return { value, unit };
}

/**
 * Validate time range input with error message
 */
export function validateTimeRange(input: string): ValidationResult {
  const sanitized = sanitizeTimeInput(input);

  if (!sanitized) {
    return { valid: false, error: "Time range is required" };
  }

  const match = sanitized.match(/^(\d+)([a-z]+)$/);

  if (!match) {
    return { valid: false, error: "Invalid format. Use: 15m, 4h, 1d, 2w" };
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (value <= 0) {
    return { valid: false, error: "Value must be positive" };
  }

  if (value > 999) {
    return { valid: false, error: "Value too large (max 999)" };
  }

  if (!["m", "h", "d", "w"].includes(unit)) {
    return { valid: false, error: "Invalid unit. Use: m, h, d, w" };
  }

  return { valid: true };
}

/**
 * Convert relative time range to actual date range
 */
export function timeRangeToDateRange(timeRange: string): DateRange {
  const parsed = parseTimeRange(timeRange);
  const now = new Date();

  if (!parsed) {
    // Default to 24h if invalid
    return { startDate: subHours(now, 24), endDate: now };
  }

  let startDate: Date;

  switch (parsed.unit) {
    case "m":
      startDate = subMinutes(now, parsed.value);
      break;
    case "h":
      startDate = subHours(now, parsed.value);
      break;
    case "d":
      startDate = subDays(now, parsed.value);
      break;
    case "w":
      startDate = subWeeks(now, parsed.value);
      break;
  }

  return { startDate, endDate: now };
}

/**
 * Format date range for display
 */
export function formatDateRangeDisplay(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
}

/**
 * Check if a time range is relative (vs custom date range)
 */
export function isRelativeTimeRange(
  timeRange?: string,
  startDate?: string,
  endDate?: string
): boolean {
  return !!timeRange && !startDate && !endDate;
}

/**
 * Convert date to ISO date string (YYYY-MM-DD)
 */
export function toISODateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Get start of day for a date string
 */
export function dateStringToStartOfDay(dateStr: string): Date {
  return startOfDay(new Date(dateStr));
}

/**
 * Get end of day for a date string
 */
export function dateStringToEndOfDay(dateStr: string): Date {
  return endOfDay(new Date(dateStr));
}
```

**Step 2: Verify file created**

Run:
```bash
ls -la apps/dashboard/lib/utils/time-range.ts
```

Expected: File exists

**Step 3: Commit**

```bash
git add apps/dashboard/lib/utils/time-range.ts
git commit -m "feat: add time range utility functions"
```

---

## Task 3: Add Calendar UI Component

**Files:**
- Create: `apps/dashboard/components/ui/calendar.tsx`

**Step 1: Create shadcn calendar component**

```typescript
"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
```

**Step 2: Verify file created**

Run:
```bash
ls -la apps/dashboard/components/ui/calendar.tsx
```

Expected: File exists

**Step 3: Commit**

```bash
git add apps/dashboard/components/ui/calendar.tsx
git commit -m "feat: add shadcn calendar component"
```

---

## Task 4: Create TimeRangePicker Component

**Files:**
- Create: `apps/dashboard/components/time-range-picker/time-range-picker.tsx`
- Create: `apps/dashboard/components/time-range-picker/index.ts`

**Step 1: Create the TimeRangePicker component**

```typescript
"use client";

import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { Clock, ChevronDown, CalendarDays, Circle } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  TIME_PRESETS,
  DEFAULT_TIME_RANGE,
  validateTimeRange,
  sanitizeTimeInput,
  formatDateRangeDisplay,
  isRelativeTimeRange,
  toISODateString,
} from "@/lib/utils/time-range";

interface TimeRangePickerProps {
  timeRange?: string;
  startDate?: string;
  endDate?: string;
  onTimeRangeChange: (timeRange: string) => void;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  className?: string;
}

export function TimeRangePicker({
  timeRange,
  startDate,
  endDate,
  onTimeRangeChange,
  onDateRangeChange,
  className,
}: TimeRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine current display value
  const displayValue = React.useMemo(() => {
    if (startDate && endDate) {
      return formatDateRangeDisplay(startDate, endDate);
    }
    return timeRange || DEFAULT_TIME_RANGE;
  }, [timeRange, startDate, endDate]);

  // Is auto-refresh active?
  const isLive = isRelativeTimeRange(timeRange, startDate, endDate);

  // Current selection for highlighting presets
  const currentSelection = timeRange || (startDate && endDate ? "custom" : DEFAULT_TIME_RANGE);

  // Reset input value when dropdown opens
  useEffect(() => {
    if (open && !showCalendar) {
      setInputValue(timeRange || "");
      setError(null);
      // Focus input after a short delay
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, showCalendar, timeRange]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setError(null);
  };

  // Handle input submit (Enter or blur)
  const handleInputSubmit = useCallback(() => {
    const sanitized = sanitizeTimeInput(inputValue);

    if (!sanitized) {
      // Empty input - just close without error
      setOpen(false);
      return;
    }

    const validation = validateTimeRange(sanitized);

    if (!validation.valid) {
      setError(validation.error || "Invalid format");
      return;
    }

    onTimeRangeChange(sanitized);
    setOpen(false);
    setError(null);
  }, [inputValue, onTimeRangeChange]);

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: string) => {
    onTimeRangeChange(preset);
    setOpen(false);
    setError(null);
  }, [onTimeRangeChange]);

  // Handle custom range selection
  const handleCustomRangeClick = () => {
    setShowCalendar(true);
  };

  // Handle calendar selection
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>();

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setCalendarRange(range);
  };

  const handleCalendarApply = () => {
    if (calendarRange?.from && calendarRange?.to) {
      onDateRangeChange(
        toISODateString(calendarRange.from),
        toISODateString(calendarRange.to)
      );
      setOpen(false);
      setShowCalendar(false);
      setCalendarRange(undefined);
    }
  };

  const handleCalendarCancel = () => {
    setShowCalendar(false);
    setCalendarRange(undefined);
  };

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInputSubmit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[160px] justify-between shrink-0", className)}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{displayValue}</span>
            {isLive && (
              <Circle className="h-2 w-2 fill-green-500 text-green-500 animate-pulse" />
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="end">
        {showCalendar ? (
          <div className="p-3">
            <Calendar
              mode="range"
              selected={calendarRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={1}
              disabled={{ after: new Date() }}
            />
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
              <Button variant="ghost" size="sm" onClick={handleCalendarCancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCalendarApply}
                disabled={!calendarRange?.from || !calendarRange?.to}
              >
                Apply
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-2">
              <Input
                ref={inputRef}
                placeholder="15m, 4h, 1d..."
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={handleInputSubmit}
                className={cn(error && "border-destructive")}
              />
              {error && (
                <p className="text-xs text-destructive mt-1 px-1">{error}</p>
              )}
            </div>
            <Separator />
            <div className="p-1">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetSelect(preset.value)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-sm rounded-sm hover:bg-accent transition-colors",
                    currentSelection === preset.value && "bg-accent font-medium"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <Separator />
            <div className="p-1">
              <button
                onClick={handleCustomRangeClick}
                className="w-full text-left px-3 py-1.5 text-sm rounded-sm hover:bg-accent transition-colors flex items-center gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                Custom range...
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Create barrel export**

```typescript
// apps/dashboard/components/time-range-picker/index.ts
export { TimeRangePicker } from "./time-range-picker";
```

**Step 3: Verify files created**

Run:
```bash
ls -la apps/dashboard/components/time-range-picker/
```

Expected: Both files exist

**Step 4: Commit**

```bash
git add apps/dashboard/components/time-range-picker/
git commit -m "feat: add TimeRangePicker component"
```

---

## Task 5: Update Filter Interfaces

**Files:**
- Modify: `apps/dashboard/hooks/queries/keys.ts`

**Step 1: Add time range fields to PipelineFilters**

In `apps/dashboard/hooks/queries/keys.ts`, update `PipelineFilters`:

```typescript
export interface PipelineFilters {
  search?: string;
  repository?: string;
  branch?: string;
  status?: string;
  timeRange?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
}
```

**Step 2: Add time range fields to ResultFilters**

In the same file, update `ResultFilters`:

```typescript
export interface ResultFilters {
  search?: string;
  repository?: string;
  project?: string;
  tags?: string;
  status?: string;
  outcome?: string;
  testRunId?: string;
  testId?: string;
  timeRange?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
}
```

**Step 3: Commit**

```bash
git add apps/dashboard/hooks/queries/keys.ts
git commit -m "feat: add time range fields to filter interfaces"
```

---

## Task 6: Update usePipelines Hook

**Files:**
- Modify: `apps/dashboard/hooks/queries/use-pipelines.ts`

**Step 1: Update usePipelines to support refetchInterval and date conversion**

Replace the entire file:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildUrl } from "@/lib/api";
import { queryKeys, type PipelineFilters } from "./keys";
import type { Pipeline, Pagination, PipelineFiltersData } from "@/types";
import {
  timeRangeToDateRange,
  isRelativeTimeRange,
  dateStringToStartOfDay,
  dateStringToEndOfDay,
} from "@/lib/utils/time-range";

interface PipelinesResponse {
  pipelines: Pipeline[];
  pagination: Pagination;
  filters: PipelineFiltersData;
}

const AUTO_REFRESH_INTERVAL = 15_000; // 15 seconds

export function usePipelines(filters: PipelineFilters) {
  // Determine if auto-refresh should be enabled
  const isLive = isRelativeTimeRange(
    filters.timeRange,
    filters.startDate,
    filters.endDate
  );

  return useQuery({
    queryKey: queryKeys.pipelines.list(filters),
    queryFn: () => {
      // Convert time range to actual dates for API
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (filters.timeRange && !filters.startDate && !filters.endDate) {
        // Relative time range
        const range = timeRangeToDateRange(filters.timeRange);
        startDate = range.startDate.toISOString();
        endDate = range.endDate.toISOString();
      } else if (filters.startDate && filters.endDate) {
        // Custom date range - use start of day and end of day
        startDate = dateStringToStartOfDay(filters.startDate).toISOString();
        endDate = dateStringToEndOfDay(filters.endDate).toISOString();
      }

      return apiFetch<PipelinesResponse>(
        buildUrl("/api/pipelines", {
          search: filters.search,
          repository: filters.repository,
          branch: filters.branch,
          status: filters.status,
          startDate,
          endDate,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          page: filters.page,
          limit: 20,
        })
      );
    },
    refetchInterval: isLive ? AUTO_REFRESH_INTERVAL : false,
  });
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/hooks/queries/use-pipelines.ts
git commit -m "feat: add auto-refresh and time range support to usePipelines"
```

---

## Task 7: Update useResults Hook

**Files:**
- Modify: `apps/dashboard/hooks/queries/use-results.ts`

**Step 1: Update useResults to support refetchInterval and date conversion**

Replace the entire file:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildUrl } from "@/lib/api";
import { queryKeys, type ResultFilters } from "./keys";
import type { TestResult, Pagination, ResultFiltersData, RunInfo, TestInfo } from "@/types";
import {
  timeRangeToDateRange,
  isRelativeTimeRange,
  dateStringToStartOfDay,
  dateStringToEndOfDay,
} from "@/lib/utils/time-range";

interface ResultsResponse {
  results: TestResult[];
  pagination: Pagination;
  filters: ResultFiltersData;
  runInfo: RunInfo | null;
  testInfo: TestInfo | null;
}

const AUTO_REFRESH_INTERVAL = 15_000; // 15 seconds

export function useResults(filters: ResultFilters) {
  // Determine if auto-refresh should be enabled
  const isLive = isRelativeTimeRange(
    filters.timeRange,
    filters.startDate,
    filters.endDate
  );

  return useQuery({
    queryKey: queryKeys.results.list(filters),
    queryFn: () => {
      // Convert time range to actual dates for API
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (filters.timeRange && !filters.startDate && !filters.endDate) {
        // Relative time range
        const range = timeRangeToDateRange(filters.timeRange);
        startDate = range.startDate.toISOString();
        endDate = range.endDate.toISOString();
      } else if (filters.startDate && filters.endDate) {
        // Custom date range - use start of day and end of day
        startDate = dateStringToStartOfDay(filters.startDate).toISOString();
        endDate = dateStringToEndOfDay(filters.endDate).toISOString();
      }

      return apiFetch<ResultsResponse>(
        buildUrl("/api/results", {
          search: filters.search,
          repository: filters.repository,
          project: filters.project,
          tags: filters.tags,
          status: filters.status,
          outcome: filters.outcome,
          testRunId: filters.testRunId,
          testId: filters.testId,
          startDate,
          endDate,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          page: filters.page,
          limit: 20,
        })
      );
    },
    refetchInterval: isLive ? AUTO_REFRESH_INTERVAL : false,
  });
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/hooks/queries/use-results.ts
git commit -m "feat: add auto-refresh and time range support to useResults"
```

---

## Task 8: Update Pipelines Page

**Files:**
- Modify: `apps/dashboard/app/dashboard/pipelines/page.tsx`

**Step 1: Import TimeRangePicker**

Add import at top of file:

```typescript
import { TimeRangePicker } from "@/components/time-range-picker";
import { DEFAULT_TIME_RANGE } from "@/lib/utils/time-range";
```

**Step 2: Parse time range from URL**

After existing filter parsing (line ~52), add:

```typescript
const timeRange = searchParams.get("timeRange") || "";
const filterStartDate = searchParams.get("startDate") || "";
const filterEndDate = searchParams.get("endDate") || "";
```

**Step 3: Add time range to filters object**

Update the filters object to include time range:

```typescript
const filters: PipelineFilters = {
  search: search || undefined,
  repository: repository || undefined,
  branch: branch || undefined,
  status: status || undefined,
  timeRange: timeRange || DEFAULT_TIME_RANGE,
  startDate: filterStartDate || undefined,
  endDate: filterEndDate || undefined,
  sortBy,
  sortOrder,
  page: pageIndex + 1,
};
```

**Step 4: Add handlers for time range changes**

After `closePipelineSheet`, add:

```typescript
const handleTimeRangeChange = useCallback(
  (newTimeRange: string) => {
    updateUrl({
      timeRange: newTimeRange,
      startDate: undefined,
      endDate: undefined,
    });
  },
  [updateUrl]
);

const handleDateRangeChange = useCallback(
  (newStartDate: string, newEndDate: string) => {
    updateUrl({
      timeRange: undefined,
      startDate: newStartDate,
      endDate: newEndDate,
    });
  },
  [updateUrl]
);
```

**Step 5: Add TimeRangePicker to toolbar**

In the toolbar, before `<DataTableColumnToggle table={table} />`, add:

```typescript
<TimeRangePicker
  timeRange={timeRange || DEFAULT_TIME_RANGE}
  startDate={filterStartDate}
  endDate={filterEndDate}
  onTimeRangeChange={handleTimeRangeChange}
  onDateRangeChange={handleDateRangeChange}
/>
```

**Step 6: Update DataTableResetFilter to include time filters**

Update the filterKeys array:

```typescript
<DataTableResetFilter
  filterKeys={["search", "repository", "branch", "status", "timeRange", "startDate", "endDate"]}
  searchParams={searchParams}
  updateUrl={updateUrl}
/>
```

**Step 7: Commit**

```bash
git add apps/dashboard/app/dashboard/pipelines/page.tsx
git commit -m "feat: add TimeRangePicker to pipelines page"
```

---

## Task 9: Update Results Page

**Files:**
- Modify: `apps/dashboard/app/dashboard/results/page.tsx`

**Step 1: Import TimeRangePicker**

Add import at top of file:

```typescript
import { TimeRangePicker } from "@/components/time-range-picker";
import { DEFAULT_TIME_RANGE } from "@/lib/utils/time-range";
```

**Step 2: Parse time range from URL**

After existing filter parsing (line ~58), add:

```typescript
const timeRange = searchParams.get("timeRange") || "";
const filterStartDate = searchParams.get("startDate") || "";
const filterEndDate = searchParams.get("endDate") || "";
```

**Step 3: Add time range to filters object**

Update the filters object:

```typescript
const filters: ResultFilters = {
  search: search || undefined,
  repository: repository || undefined,
  project: project || undefined,
  tags: tags || undefined,
  status: status || undefined,
  outcome: outcome || undefined,
  testRunId: testRunId || undefined,
  testId: testId || undefined,
  timeRange: timeRange || DEFAULT_TIME_RANGE,
  startDate: filterStartDate || undefined,
  endDate: filterEndDate || undefined,
  sortBy,
  sortOrder,
  page: pageIndex + 1,
};
```

**Step 4: Add handlers for time range changes**

After `closeResultSheet`, add:

```typescript
const handleTimeRangeChange = useCallback(
  (newTimeRange: string) => {
    updateUrl({
      timeRange: newTimeRange,
      startDate: undefined,
      endDate: undefined,
    });
  },
  [updateUrl]
);

const handleDateRangeChange = useCallback(
  (newStartDate: string, newEndDate: string) => {
    updateUrl({
      timeRange: undefined,
      startDate: newStartDate,
      endDate: newEndDate,
    });
  },
  [updateUrl]
);
```

**Step 5: Add TimeRangePicker to toolbar**

In the toolbar, before `<DataTableColumnToggle table={table} />`, add:

```typescript
<TimeRangePicker
  timeRange={timeRange || DEFAULT_TIME_RANGE}
  startDate={filterStartDate}
  endDate={filterEndDate}
  onTimeRangeChange={handleTimeRangeChange}
  onDateRangeChange={handleDateRangeChange}
/>
```

**Step 6: Update DataTableResetFilter to include time filters**

Update the filterKeys array:

```typescript
<DataTableResetFilter
  filterKeys={["search", "repository", "project", "tags", "status", "outcome", "timeRange", "startDate", "endDate"]}
  searchParams={searchParams}
  updateUrl={updateUrl}
/>
```

**Step 7: Commit**

```bash
git add apps/dashboard/app/dashboard/results/page.tsx
git commit -m "feat: add TimeRangePicker to results page"
```

---

## Task 10: Manual Testing

**Step 1: Start development server**

Run:
```bash
tilt up
```

Or:
```bash
cd apps/dashboard && pnpm dev
```

**Step 2: Test pipelines page**

Navigate to `http://localhost:3031/dashboard/pipelines`

Verify:
- [ ] TimeRangePicker appears in toolbar (right side, before columns toggle)
- [ ] Default shows "24h" with green pulsing dot (live indicator)
- [ ] Clicking opens dropdown with presets
- [ ] Typing "15m" and pressing Enter filters data
- [ ] Typing invalid input shows error message
- [ ] Selecting preset filters data
- [ ] "Custom range..." opens calendar
- [ ] Calendar selection filters data
- [ ] URL updates with `?timeRange=...` or `?startDate=...&endDate=...`
- [ ] Page auto-refreshes every 15s with relative time (check network tab)
- [ ] Custom date range does NOT auto-refresh
- [ ] Reset filter clears time range to default

**Step 3: Test results page**

Navigate to `http://localhost:3031/dashboard/results`

Verify same behavior as pipelines page.

**Step 4: Final commit**

If any fixes were needed during testing, commit them:

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install dependencies | package.json |
| 2 | Create time utilities | lib/utils/time-range.ts |
| 3 | Add Calendar component | components/ui/calendar.tsx |
| 4 | Create TimeRangePicker | components/time-range-picker/* |
| 5 | Update filter interfaces | hooks/queries/keys.ts |
| 6 | Update usePipelines hook | hooks/queries/use-pipelines.ts |
| 7 | Update useResults hook | hooks/queries/use-results.ts |
| 8 | Update pipelines page | app/dashboard/pipelines/page.tsx |
| 9 | Update results page | app/dashboard/results/page.tsx |
| 10 | Manual testing | - |
