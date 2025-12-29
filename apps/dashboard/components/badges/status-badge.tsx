import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getStatusVariant,
  getOutcomeVariant,
  getRunStatusVariant,
} from "@/lib/utils/badges";

export interface StatusBadgeProps {
  /** The status value to display */
  status: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Badge component for displaying test execution status
 *
 * @example
 * ```tsx
 * <StatusBadge status="passed" />
 * <StatusBadge status="failed" />
 * <StatusBadge status="skipped" />
 * ```
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = getStatusVariant(status);

  return (
    <Badge className={`${variant} ${className || ""}`}>
      {status}
    </Badge>
  );
}

export interface OutcomeBadgeProps {
  /** The outcome value (expected, unexpected, flaky, skipped) */
  outcome: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Badge component for displaying test outcome
 *
 * @example
 * ```tsx
 * <OutcomeBadge outcome="expected" />
 * <OutcomeBadge outcome="flaky" />
 * ```
 */
export function OutcomeBadge({ outcome, className }: OutcomeBadgeProps) {
  const variant = getOutcomeVariant(outcome);

  return (
    <Badge className={`${variant} ${className || ""}`}>
      {outcome}
    </Badge>
  );
}

export interface RunStatusBadgeProps {
  /** The run status (running, passed, failed, interrupted) */
  status: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Badge component for displaying test run status
 *
 * @example
 * ```tsx
 * <RunStatusBadge status="running" />
 * <RunStatusBadge status="passed" />
 * ```
 */
export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  const variant = getRunStatusVariant(status);

  return (
    <Badge className={`${variant} ${className || ""}`}>
      {status}
    </Badge>
  );
}

export interface StatusBadgeWithTooltipProps {
  /** The actual status */
  status: string;
  /** The expected status */
  expectedStatus: string;
  /** The outcome (expected, unexpected, flaky, skipped) */
  outcome: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Status badge with tooltip explaining expected vs actual status
 *
 * @example
 * ```tsx
 * <StatusBadgeWithTooltip
 *   status="passed"
 *   expectedStatus="passed"
 *   outcome="expected"
 * />
 * ```
 */
export function StatusBadgeWithTooltip({
  status,
  expectedStatus,
  outcome,
  className,
}: StatusBadgeWithTooltipProps) {
  // Determine if result is unexpected
  const isUnexpected = outcome === "unexpected";
  const isFailed = status === "failed" || status === "timedOut";
  const isRed = isFailed || isUnexpected;

  // Get appropriate variant
  const variants: Record<string, string> = {
    passed: isRed ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600",
    failed: "bg-red-500/10 text-red-600",
    timedOut: "bg-orange-500/10 text-orange-600",
    skipped: "bg-gray-500/10 text-gray-600",
    interrupted: "bg-yellow-500/10 text-yellow-600",
  };

  // Generate tooltip message
  let tooltipMessage = "";
  let tooltipColor = "text-green-600";

  if (outcome === "skipped") {
    tooltipMessage = "Skipped";
    tooltipColor = "text-muted-foreground";
  } else if (status === expectedStatus || (status === "passed" && expectedStatus === "passed")) {
    tooltipMessage = expectedStatus === "failed" ? "Expected to fail" : "Expected to pass";
    tooltipColor = "text-green-600";
  } else if (expectedStatus === "failed" && status === "passed") {
    tooltipMessage = "Expected to fail, but passed";
    tooltipColor = "text-red-600";
  } else if (expectedStatus === "passed" && (status === "failed" || status === "timedOut")) {
    tooltipMessage = "Expected to pass, but failed";
    tooltipColor = "text-red-600";
  } else {
    tooltipMessage = `Expected: ${expectedStatus}, Actual: ${status}`;
    tooltipColor = isUnexpected ? "text-red-600" : "text-green-600";
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`${variants[status] || variants.skipped} cursor-help ${className || ""}`}>
          {status}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <span className={tooltipColor}>{tooltipMessage}</span>
      </TooltipContent>
    </Tooltip>
  );
}
