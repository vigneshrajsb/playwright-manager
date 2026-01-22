"use client";

import * as React from "react";
import { Clock, ChevronDown, CalendarDays, Circle } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
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
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(
    timeRange || DEFAULT_TIME_RANGE
  );
  const [inputError, setInputError] = React.useState<string | null>(null);
  const [showCalendar, setShowCalendar] = React.useState(false);
  const [calendarRange, setCalendarRange] = React.useState<
    DateRange | undefined
  >(undefined);

  const isLiveMode = isRelativeTimeRange(timeRange, startDate, endDate);

  // Get display value for trigger button
  const displayValue = React.useMemo(() => {
    if (startDate && endDate) {
      return formatDateRangeDisplay(startDate, endDate);
    }
    return timeRange || DEFAULT_TIME_RANGE;
  }, [timeRange, startDate, endDate]);

  // Reset state when popover opens
  React.useEffect(() => {
    if (open) {
      setInputValue(timeRange || DEFAULT_TIME_RANGE);
      setInputError(null);
      setShowCalendar(false);
      setCalendarRange(undefined);
    }
  }, [open, timeRange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setInputError(null);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const sanitized = sanitizeTimeInput(inputValue);
      const validation = validateTimeRange(sanitized);

      if (validation.valid) {
        onTimeRangeChange(sanitized);
        setOpen(false);
      } else {
        setInputError(validation.error || "Invalid time range");
      }
    }
  };

  const handlePresetClick = (preset: string) => {
    onTimeRangeChange(preset);
    setOpen(false);
  };

  const handleCustomRangeClick = () => {
    setShowCalendar(true);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setCalendarRange(range);
  };

  const handleApplyDateRange = () => {
    if (calendarRange?.from && calendarRange?.to) {
      const start = toISODateString(calendarRange.from);
      const end = toISODateString(calendarRange.to);
      onDateRangeChange(start, end);
      setOpen(false);
    }
  };

  const handleCancelDateRange = () => {
    setShowCalendar(false);
    setCalendarRange(undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("gap-2", className)}>
          {isLiveMode ? (
            <>
              <Circle className="size-2 fill-green-500 text-green-500 animate-pulse" />
              <Clock className="size-4" />
            </>
          ) : (
            <CalendarDays className="size-4" />
          )}
          <span>{displayValue}</span>
          <ChevronDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        {showCalendar ? (
          <div className="flex flex-col">
            <Calendar
              mode="range"
              selected={calendarRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={1}
            />
            <Separator />
            <div className="flex justify-end gap-2 p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelDateRange}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApplyDateRange}
                disabled={!calendarRange?.from || !calendarRange?.to}
              >
                Apply
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-3">
            <div className="flex flex-col gap-1">
              <Input
                placeholder="e.g., 24h, 7d, 15m"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
              />
              {inputError && (
                <p className="text-xs text-destructive">{inputError}</p>
              )}
            </div>

            <Separator />

            <div className="flex flex-wrap gap-1">
              {TIME_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  variant={timeRange === preset ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>

            <Separator />

            <Button
              variant="ghost"
              className="justify-start"
              onClick={handleCustomRangeClick}
            >
              <CalendarDays className="size-4" />
              Custom range...
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
