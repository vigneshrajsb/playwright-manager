import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["swagger-ui-react"],
};

export default nextConfig;
