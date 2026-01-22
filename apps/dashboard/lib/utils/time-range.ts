import {
  subMinutes,
  subHours,
  subDays,
  subWeeks,
  startOfDay,
  endOfDay,
  format,
  parse,
} from "date-fns";

/**
 * Preset time range options
 */
export const TIME_PRESETS = ["15m", "1h", "4h", "24h", "7d", "30d"] as const;

export type TimePreset = (typeof TIME_PRESETS)[number];

/**
 * Default time range
 */
export const DEFAULT_TIME_RANGE = "24h";

/**
 * Valid time units
 */
export type TimeUnit = "m" | "h" | "d" | "w";

export interface ParsedTimeRange {
  value: number;
  unit: TimeUnit;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Sanitize time input by trimming, lowercasing, and removing whitespace
 */
export function sanitizeTimeInput(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Parse a time range string like "15m" into { value: 15, unit: 'm' }
 * Returns null if invalid. Units: m, h, d, w. Value must be 1-999.
 */
export function parseTimeRange(input: string): ParsedTimeRange | null {
  const sanitized = sanitizeTimeInput(input);
  const match = sanitized.match(/^(\d+)([mhdw])$/);

  if (!match) {
    return null;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2] as TimeUnit;

  // Value must be between 1 and 999
  if (value < 1 || value > 999) {
    return null;
  }

  return { value, unit };
}

/**
 * Validate a time range string
 * Returns { valid: boolean, error?: string }
 */
export function validateTimeRange(input: string): ValidationResult {
  const sanitized = sanitizeTimeInput(input);

  if (!sanitized) {
    return { valid: false, error: "Time range cannot be empty" };
  }

  const match = sanitized.match(/^(\d+)([a-z]+)$/);

  if (!match) {
    return { valid: false, error: "Invalid format. Use format like '24h', '7d', '15m'" };
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (!["m", "h", "d", "w"].includes(unit)) {
    return { valid: false, error: "Invalid unit. Use 'm' (minutes), 'h' (hours), 'd' (days), or 'w' (weeks)" };
  }

  if (value < 1) {
    return { valid: false, error: "Value must be at least 1" };
  }

  if (value > 999) {
    return { valid: false, error: "Value must be 999 or less" };
  }

  return { valid: true };
}

/**
 * Convert a time range string like "24h" to a date range { startDate, endDate }
 * Returns the range from (now - duration) to now
 */
export function timeRangeToDateRange(timeRange: string): DateRange {
  const parsed = parseTimeRange(timeRange);
  const endDate = new Date();

  if (!parsed) {
    // Default to 24h if invalid
    return {
      startDate: subHours(endDate, 24),
      endDate,
    };
  }

  let startDate: Date;

  switch (parsed.unit) {
    case "m":
      startDate = subMinutes(endDate, parsed.value);
      break;
    case "h":
      startDate = subHours(endDate, parsed.value);
      break;
    case "d":
      startDate = subDays(endDate, parsed.value);
      break;
    case "w":
      startDate = subWeeks(endDate, parsed.value);
      break;
    default:
      startDate = subHours(endDate, 24);
  }

  return { startDate, endDate };
}

/**
 * Format a date range for display as "Jan 15 - Jan 20"
 */
export function formatDateRangeDisplay(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startFormatted = format(start, "MMM d");
  const endFormatted = format(end, "MMM d");

  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Check if using a relative time range (timeRange is set and dates are not)
 */
export function isRelativeTimeRange(
  timeRange?: string,
  startDate?: string,
  endDate?: string
): boolean {
  return !!timeRange && !startDate && !endDate;
}

/**
 * Format a Date as an ISO date string "yyyy-MM-dd"
 */
export function toISODateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Parse a date string and get the start of that day
 */
export function dateStringToStartOfDay(dateStr: string): Date {
  const date = parse(dateStr, "yyyy-MM-dd", new Date());
  return startOfDay(date);
}

/**
 * Parse a date string and get the end of that day
 */
export function dateStringToEndOfDay(dateStr: string): Date {
  const date = parse(dateStr, "yyyy-MM-dd", new Date());
  return endOfDay(date);
}
