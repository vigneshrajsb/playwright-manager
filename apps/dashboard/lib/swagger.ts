import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: "app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Playwright Manager API",
        version: "1.0.0",
        description:
          "API for managing Playwright test reports, test health tracking, and remote test enable/disable functionality.",
      },
      servers: [
        {
          url: "http://localhost:3031",
          description: "Development server",
        },
      ],
      tags: [
        {
          name: "Health",
          description: "Health check endpoint",
        },
        {
          name: "Dashboard",
          description: "Dashboard overview data",
        },
        {
          name: "Tests",
          description: "Test management endpoints",
        },
        {
          name: "Runs",
          description: "Test run management endpoints",
        },
        {
          name: "Reports",
          description: "Report ingestion endpoints",
        },
      ],
    },
  });
  return spec;
};
