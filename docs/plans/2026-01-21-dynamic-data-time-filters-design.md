# Dynamic Data & Time Range Filters Design

## Overview

Add real-time data updates and time range filtering to the pipelines and results tables in the dashboard. Users should see fresh data without manual refresh and quickly filter by relative time ranges or custom date ranges.

## Requirements

1. **Periodic auto-refresh** - Tables refresh automatically every 15 seconds when viewing relative time ranges
2. **Time range filter** - Datadog-style picker with presets, typeable input, and custom date range
3. **URL persistence** - Time range persisted in URL for shareable links
4. **Independent state** - Each page (pipelines/results) maintains its own time range

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Refresh mechanism | React Query `refetchInterval` | Already using React Query; minimal changes needed |
| Refresh interval | 15 seconds | Good balance between freshness and server load |
| Auto-refresh trigger | Automatic based on filter type | Relative range = ON, custom date range = OFF |
| Time syntax | Simple units (15m, 4h, 1d) | Easy to type and parse |
| Presets | 15m, 1h, 4h, 24h, 7d, 30d | Covers quick debugging to monthly trends |
| Default | 24h | Reasonable default for CI monitoring |
| Custom range | Date picker only (no time) | Simpler UI, covers most use cases |
| UI placement | Right side, before columns toggle | Separates data filters from view controls |

## Component Design

### TimeRangePicker Component

A combined dropdown/input component with three states:

#### 1. Collapsed State
```
┌─────────────┐
│ 🕐 24h    ▼ │
└─────────────┘
```
- Shows clock icon, current value, dropdown chevron
- Click opens dropdown
- "Live" indicator (pulsing dot) when auto-refresh active

#### 2. Dropdown Open State
```
┌──────────────────────┐
│ [15m_____________] ← │  ← Typeable input (focused)
├──────────────────────┤
│   15m                │
│   1h                 │
│   4h                 │
│ ● 24h                │  ← Selected indicator
│   7d                 │
│   30d                │
├──────────────────────┤
│ 📅 Custom range...   │
└──────────────────────┘
```
- Input field at top for typing custom relative times
- Preset options below with selection indicator
- Custom range option at bottom

#### 3. Custom Range Popover
```
┌─────────────────────────────────────────┐
│  Start Date          End Date           │
│ ┌─────────────┐    ┌─────────────┐      │
│ │  January    │    │  January    │      │
│ │ Su Mo Tu .. │    │ Su Mo Tu .. │      │
│ │  1  2  3 .. │    │  1  2  3 .. │      │
│ └─────────────┘    └─────────────┘      │
│                                         │
│              [Cancel]  [Apply]          │
└─────────────────────────────────────────┘
```
- Side-by-side calendars
- Apply commits the selection, Cancel reverts

### Filter Bar Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [Search...]  [Repository ▼]  [Branch ▼]  [Status ▼]    [🕐 24h ▼] [⫶ ▼]   │
│                                                         ↑          ↑       │
│                                              Time Range Picker   Columns   │
└────────────────────────────────────────────────────────────────────────────┘
```

## Input Validation & Error Handling

### Valid Input Formats

```
Relative time: <number><unit>
- Units: m (minutes), h (hours), d (days), w (weeks)
- Examples: 15m, 4h, 1d, 2w

Constraints:
- Number must be positive integer (1-999)
- Unit must be one of: m, h, d, w
- No spaces allowed
- Case insensitive (15M = 15m)
```

### Validation Rules

| Input | Valid | Reason |
|-------|-------|--------|
| `15m` | ✓ | Valid relative time |
| `4h` | ✓ | Valid relative time |
| `2w` | ✓ | Valid relative time |
| `15M` | ✓ | Case insensitive |
| `0m` | ✗ | Zero not allowed |
| `-15m` | ✗ | Negative not allowed |
| `15` | ✗ | Missing unit |
| `m15` | ✗ | Wrong order |
| `15 m` | ✗ | No spaces |
| `15mins` | ✗ | Invalid unit |
| `1.5h` | ✗ | No decimals |
| `1000d` | ✗ | Exceeds max (999) |
| `abc` | ✗ | Not a valid format |

### Sanitization

```typescript
function sanitizeTimeInput(input: string): string {
  return input
    .trim()                    // Remove leading/trailing whitespace
    .toLowerCase()             // Normalize case
    .replace(/\s+/g, '');      // Remove internal whitespace
}
```

### Error States

#### Input Error State
When user types invalid input and presses Enter or blurs:

```
┌──────────────────────────┐
│ [15mins___________] ←    │
│ ⚠️ Invalid format        │  ← Error message
├──────────────────────────┤
│   Use: 15m, 4h, 1d, 2w   │  ← Help text
├──────────────────────────┤
│   15m                    │
│   ...                    │
└──────────────────────────┘
```

- Input border turns red (destructive color)
- Error message appears below input
- Help text shows valid format examples
- Previous valid selection remains active (not changed)
- Error clears when user starts typing again

#### Behavior on Invalid Input

1. **On blur with invalid input:** Show error, revert display to previous valid value
2. **On Enter with invalid input:** Show error, keep focus in input for correction
3. **On selecting preset:** Clear any error state
4. **On opening dropdown:** Clear any error state, show current value in input

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Empty input + Enter | Revert to previous value, no error |
| Empty input + blur | Revert to previous value, no error |
| Whitespace only | Treat as empty |
| Very large range (e.g., 999d) | Allow - let user query wide ranges |
| Paste invalid text | Sanitize, validate, show error if invalid |
| URL has invalid timeRange | Fall back to default (24h), no error shown |

## URL State

### Parameters

```
Relative range:
/dashboard/pipelines?timeRange=24h&page=1&...

Custom date range:
/dashboard/pipelines?startDate=2025-01-15&endDate=2025-01-20&page=1&...
```

### Rules

- `timeRange` and `startDate`/`endDate` are mutually exclusive
- If both present in URL, `timeRange` takes precedence
- Missing time params = default to `24h`
- Invalid `timeRange` in URL = fall back to `24h`
- Changing time range resets pagination to page 1

## Auto-Refresh Behavior

### Rules

```typescript
const isRelativeRange = filters.timeRange && !filters.startDate && !filters.endDate;
const refetchInterval = isRelativeRange ? 15_000 : false;
```

| Filter Type | Auto-Refresh | Interval |
|-------------|--------------|----------|
| Relative (15m, 1h, etc.) | ON | 15 seconds |
| Custom date range | OFF | - |

### Visual Indicator

When auto-refresh is active:
- Small pulsing dot next to time picker
- Or "Live" text badge
- Subtle flash on table when new data arrives (optional enhancement)

## Data Flow

```
User selects time range
    ↓
TimeRangePicker updates URL params
    ↓
useDataTableUrlState detects change
    ↓
Filter object updated with timeRange OR startDate/endDate
    ↓
usePipelines/useResults hook:
    - Converts timeRange to actual startDate/endDate
    - Computes refetchInterval based on filter type
    - Calls API with date params
    ↓
React Query:
    - Fetches data
    - Sets up refetchInterval if applicable
    ↓
DataTable renders results
    ↓
(Every 15s if auto-refresh active)
    ↓
React Query refetches → Table updates
```

## Implementation Plan

### New Files

| File | Purpose |
|------|---------|
| `components/time-range-picker/time-range-picker.tsx` | Main component |
| `components/time-range-picker/time-presets.ts` | Presets and constants |
| `components/time-range-picker/time-utils.ts` | Parsing, validation, conversion |
| `components/time-range-picker/index.ts` | Barrel export |

### Modified Files

| File | Changes |
|------|---------|
| `hooks/use-data-table.ts` | Add timeRange, startDate, endDate to state |
| `hooks/queries/use-pipelines.ts` | Add refetchInterval support, date conversion |
| `hooks/queries/use-results.ts` | Add refetchInterval support, date conversion |
| `app/dashboard/pipelines/page.tsx` | Add TimeRangePicker, wire up auto-refresh |
| `app/dashboard/results/page.tsx` | Add TimeRangePicker, wire up auto-refresh |

### Utility Functions

```typescript
// time-utils.ts

interface ParsedTimeRange {
  value: number;
  unit: 'm' | 'h' | 'd' | 'w';
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Sanitize raw input
function sanitizeTimeInput(input: string): string;

// Parse "15m" → { value: 15, unit: 'm' }
function parseTimeRange(input: string): ParsedTimeRange | null;

// Validate with error message
function validateTimeRange(input: string): ValidationResult;

// Convert "24h" → { startDate: Date, endDate: Date }
function timeRangeToDateRange(timeRange: string): DateRange;

// Format for display: "24h" or "Jan 15 - Jan 20"
function formatTimeRangeDisplay(
  timeRange?: string,
  startDate?: string,
  endDate?: string
): string;
```

### Component Props

```typescript
interface TimeRangePickerProps {
  // Current values (from URL state)
  timeRange?: string;
  startDate?: string;
  endDate?: string;

  // Callbacks
  onTimeRangeChange: (timeRange: string) => void;
  onDateRangeChange: (startDate: string, endDate: string) => void;

  // Optional
  className?: string;
}
```

## Testing Considerations

### Unit Tests (time-utils.ts)

- Parse valid inputs: 15m, 4h, 1d, 2w
- Parse case variations: 15M, 4H
- Reject invalid inputs: 0m, -15m, 15, m15, 15mins, abc
- Sanitization: whitespace, case normalization
- Date range conversion accuracy

### Component Tests (TimeRangePicker)

- Renders current value
- Opens dropdown on click
- Selects preset and closes
- Types valid input → applies on Enter
- Types invalid input → shows error
- Error clears on new input
- Custom range picker opens/applies/cancels
- Live indicator shows for relative ranges

### Integration Tests

- URL updates when time range changes
- Page resets to 1 on time change
- Auto-refresh activates for relative ranges
- Auto-refresh stops for custom ranges
- Invalid URL param falls back to default

## Dependencies

Using existing shadcn/ui components:
- `Popover` - Dropdown container
- `Command` - Searchable list for presets
- `Calendar` - Date picker (already in project)
- `Button` - Actions
- `Input` - Typeable field

No new external dependencies required.
