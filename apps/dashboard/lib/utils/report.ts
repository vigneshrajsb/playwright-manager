import { apiFetch } from "@/lib/api";

interface ReportUrlResponse {
  url: string;
}

/**
 * Fetch the presigned URL for a report and open it in a new tab
 * @param runId - The test run ID
 * @param testId - Optional playwright test ID to navigate directly to a specific test
 */
export async function openReportUrl(
  runId: string,
  testId?: string
): Promise<void> {
  try {
    const { url } = await apiFetch<ReportUrlResponse>(
      `/api/reports/${runId}/url`
    );
    const reportUrl = testId ? `${url}#?testId=${testId}` : url;
    window.open(reportUrl, "_blank");
  } catch (error) {
    console.error("Failed to get report URL", error);
  }
}
