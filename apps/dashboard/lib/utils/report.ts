/**
 * Open a Playwright HTML report in a new tab via the server-side proxy
 * @param runId - The test run ID
 * @param testId - Optional playwright test ID to navigate directly to a specific test
 */
export function openReportUrl(runId: string, testId?: string): void {
  const baseUrl = `/api/reports/${runId}/view/index.html`;
  const reportUrl = testId ? `${baseUrl}#?testId=${testId}` : baseUrl;
  window.open(reportUrl, "_blank");
}
