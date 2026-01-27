import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["swagger-ui-react"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/drizzle-orm/**/*", "./node_modules/postgres/**/*"],
  },
};

export default nextConfig;
