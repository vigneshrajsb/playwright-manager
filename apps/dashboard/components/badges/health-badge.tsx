import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getHealthVariant,
  getHealthLabel,
  getHealthLevel,
} from "@/lib/utils/badges";
import { TrendingDown, TrendingUp } from "lucide-react";

// Configurable threshold for showing divergence indicator
const DIVERGENCE_THRESHOLD = parseFloat(
  process.env.NEXT_PUBLIC_HEALTH_DIVERGENCE_THRESHOLD || "15"
);

export interface HealthBadgeProps {
  /** Health score (0-100) or null/undefined for unknown */
  score: number | null | undefined;
  /** Show the score value alongside the label */
  showScore?: boolean;
  /** Recent pass rate (last N runs) for divergence indicator */
  recentPassRate?: number | string | null;
  /** Overall pass rate for divergence indicator */
  overallPassRate?: number | string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Badge component for displaying test health status
 *
 * @example
 * ```tsx
 * <HealthBadge score={85} />           // Shows "Healthy"
 * <HealthBadge score={65} />           // Shows "Flaky"
 * <HealthBadge score={30} />           // Shows "Failing"
 * <HealthBadge score={null} />         // Shows "No data"
 * <HealthBadge score={85} showScore /> // Shows "Healthy (85)"
 * <HealthBadge score={85} recentPassRate={60} overallPassRate={90} /> // Shows declining indicator
 * ```
 */
export function HealthBadge({
  score,
  showScore = false,
  recentPassRate,
  overallPassRate,
  className,
}: HealthBadgeProps) {
  const level = getHealthLevel(score);
  const variant = getHealthVariant(score);
  const label = getHealthLabel(score);

  // Parse rates to numbers
  const recent =
    recentPassRate !== null && recentPassRate !== undefined
      ? typeof recentPassRate === "string"
        ? parseFloat(recentPassRate)
        : recentPassRate
      : null;
  const overall =
    overallPassRate !== null && overallPassRate !== undefined
      ? typeof overallPassRate === "string"
        ? parseFloat(overallPassRate)
        : overallPassRate
      : null;

  // Calculate divergence
  const divergence = recent !== null && overall !== null ? recent - overall : null;
  const showDivergenceIndicator =
    divergence !== null && Math.abs(divergence) >= DIVERGENCE_THRESHOLD;
  const isDeclining = divergence !== null && divergence < -DIVERGENCE_THRESHOLD;
  const isImproving = divergence !== null && divergence > DIVERGENCE_THRESHOLD;

  // Use outline variant for unknown/no data
  if (level === "unknown") {
    return (
      <Badge variant="outline" className={className}>
        {label}
      </Badge>
    );
  }

  const badgeContent = (
    <Badge className={`${variant} ${className || ""} inline-flex items-center gap-1`}>
      {showScore && score !== null && score !== undefined
        ? `${label} (${score})`
        : label}
      {showDivergenceIndicator && (
        <>
          {isDeclining && (
            <TrendingDown className="h-3 w-3 text-red-600" />
          )}
          {isImproving && (
            <TrendingUp className="h-3 w-3 text-green-600" />
          )}
        </>
      )}
    </Badge>
  );

  // If we have divergence info, wrap in tooltip
  if (showDivergenceIndicator && recent !== null && overall !== null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent>
          <p>
            Recent: {recent.toFixed(0)}% vs Overall: {overall.toFixed(0)}%
            {isDeclining && " (declining)"}
            {isImproving && " (improving)"}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badgeContent;
}
