import { Badge } from "@/components/ui/badge";
import {
  getHealthVariant,
  getHealthLabel,
  getHealthLevel,
} from "@/lib/utils/badges";

export interface HealthBadgeProps {
  /** Health score (0-100) or null/undefined for unknown */
  score: number | null | undefined;
  /** Show the score value alongside the label */
  showScore?: boolean;
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
 * ```
 */
export function HealthBadge({ score, showScore = false, className }: HealthBadgeProps) {
  const level = getHealthLevel(score);
  const variant = getHealthVariant(score);
  const label = getHealthLabel(score);

  // Use outline variant for unknown/no data
  if (level === "unknown") {
    return (
      <Badge variant="outline" className={className}>
        {label}
      </Badge>
    );
  }

  return (
    <Badge className={`${variant} ${className || ""}`}>
      {showScore && score !== null && score !== undefined
        ? `${label} (${score})`
        : label}
    </Badge>
  );
}
