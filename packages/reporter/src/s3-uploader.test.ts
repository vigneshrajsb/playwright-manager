import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadReportDirectory } from "./s3-uploader";
import type { S3ReportConfig } from "./types";

const mockSend = vi.fn().mockResolvedValue({});
const MockS3Client = vi.fn(function (this: any) {
  this.send = mockSend;
});
const MockPutObjectCommand = vi.fn(function (this: any, params: any) {
  Object.assign(this, params);
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: MockS3Client,
  PutObjectCommand: MockPutObjectCommand,
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readdirSync: vi.fn().mockReturnValue([
      { name: "index.html", isDirectory: () => false },
      { name: "styles.css", isDirectory: () => false },
    ]),
    readFileSync: vi.fn().mockReturnValue(Buffer.from("file content")),
  };
});

const fs = await import("node:fs");

const baseConfig: S3ReportConfig = {
  bucket: "my-bucket",
  region: "us-east-1",
};

beforeEach(() => {
  MockS3Client.mockClear();
  MockPutObjectCommand.mockClear();
  mockSend.mockClear();
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readdirSync).mockReturnValue([
    { name: "index.html", isDirectory: () => false },
    { name: "styles.css", isDirectory: () => false },
  ] as any);
  vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from("file content"));
});

describe("uploadReportDirectory", () => {
  it("uploads files to correct S3 paths", async () => {
    await uploadReportDirectory(baseConfig, "org/repo", "run-123");

    expect(MockPutObjectCommand).toHaveBeenCalledTimes(2);

    const firstCall = MockPutObjectCommand.mock.calls[0][0];
    expect(firstCall.Bucket).toBe("my-bucket");
    expect(firstCall.Key).toBe("reports/org/repo/run-123/index.html");

    const secondCall = MockPutObjectCommand.mock.calls[1][0];
    expect(secondCall.Key).toBe("reports/org/repo/run-123/styles.css");
  });

  it("returns correct base path", async () => {
    const result = await uploadReportDirectory(baseConfig, "org/repo", "run-123");
    expect(result).toBe("reports/org/repo/run-123");
  });

  it("uses custom pathPrefix", async () => {
    const config: S3ReportConfig = {
      ...baseConfig,
      pathPrefix: "custom-prefix",
    };

    await uploadReportDirectory(config, "org/repo", "run-123");

    const firstCall = MockPutObjectCommand.mock.calls[0][0];
    expect(firstCall.Key).toBe("custom-prefix/org/repo/run-123/index.html");
  });

  it('uses default reportDir "playwright-report"', async () => {
    await uploadReportDirectory(baseConfig, "org/repo", "run-123");

    expect(fs.existsSync).toHaveBeenCalledWith("playwright-report");
  });

  it("sets forcePathStyle when endpoint is configured", async () => {
    const config: S3ReportConfig = {
      ...baseConfig,
      endpoint: "https://minio.example.com",
    };

    await uploadReportDirectory(config, "org/repo", "run-123");

    expect(MockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        forcePathStyle: true,
        endpoint: "https://minio.example.com",
      }),
    );
  });

  it("uses credentials when provided", async () => {
    const config: S3ReportConfig = {
      ...baseConfig,
      accessKeyId: "AKID",
      secretAccessKey: "SECRET",
    };

    await uploadReportDirectory(config, "org/repo", "run-123");

    expect(MockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: {
          accessKeyId: "AKID",
          secretAccessKey: "SECRET",
        },
      }),
    );
  });

  it("throws when report directory doesn't exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(uploadReportDirectory(baseConfig, "org/repo", "run-123")).rejects.toThrow(
      "Report directory not found",
    );
  });

  it.each([
    ["index.html", "text/html"],
    ["styles.css", "text/css"],
    ["app.js", "application/javascript"],
  ])("maps %s to %s content type", async (fileName, expectedContentType) => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: fileName, isDirectory: () => false },
    ] as any);

    await uploadReportDirectory(baseConfig, "org/repo", "run-123");

    const call = MockPutObjectCommand.mock.calls[0][0];
    expect(call.ContentType).toBe(expectedContentType);
  });
});
