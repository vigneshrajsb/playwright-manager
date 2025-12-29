/**
 * Format a date string for display
 * Example output: "Dec 28, 10:30 AM"
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Never";

  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a duration in milliseconds to human-readable format
 * Examples: "150ms", "2.5s", "1m 30s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format a date as relative time
 * Examples: "5m ago", "2h ago", "3d ago"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // For older dates, show the actual date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a pass rate percentage
 * Example: "95.5%" or "95%"
 */
export function formatPassRate(rate: string | number): string {
  const numRate = typeof rate === "string" ? parseFloat(rate) : rate;

  // If it's a whole number, don't show decimals
  if (numRate % 1 === 0) {
    return `${numRate.toFixed(0)}%`;
  }

  return `${numRate.toFixed(1)}%`;
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Format a commit SHA for display (first 7 characters)
 */
export function formatCommitSha(sha: string | null | undefined): string {
  if (!sha) return "";
  return sha.slice(0, 7);
}
