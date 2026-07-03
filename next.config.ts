import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: [
    "@resvg/resvg-js",
    "sharp",
    "@react-pdf/renderer",
    "@libsql/client",
  ],
};

export default nextConfig;
