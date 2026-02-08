export function createMockTestCase(overrides?: Record<string, any>) {
  return {
    id: "test-id-1",
    title: "my test",
    titlePath: () => ["suite", "my test"],
    location: { file: "/absolute/path/tests/example.spec.ts", line: 10, column: 5 },
    parent: { project: () => ({ name: "default", retries: 0 }) },
    tags: [] as string[],
    annotations: [] as Array<{ type: string; description?: string }>,
    expectedStatus: "passed" as const,
    ...overrides,
  };
}

export function createMockTestResult(overrides?: Record<string, any>) {
  return {
    status: "passed" as const,
    duration: 1500,
    retry: 0,
    workerIndex: 0,
    parallelIndex: 0,
    startTime: new Date("2024-01-01T00:00:00Z"),
    error: undefined as { message?: string; stack?: string } | undefined,
    attachments: [] as Array<{ name: string; contentType: string; path?: string }>,
    ...overrides,
  };
}

export function createMockFullConfig(overrides?: Record<string, any>) {
  return {
    projects: [{ name: "default", use: { baseURL: "http://localhost:3000" }, retries: 0 }],
    version: "1.40.0",
    workers: 4,
    shard: null as { current: number; total: number } | null,
    ...overrides,
  } as any;
}

export function createMockSuite() {
  return {} as any;
}

export function createMockFullResult(overrides?: Record<string, any>) {
  return { status: "passed" as const, ...overrides } as any;
}
