import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep document parsers in the Node.js server runtime. They receive private
  // course files only after a Server Action has authorized the owner.
  serverExternalPackages: ["mammoth", "parse5", "unpdf"],
};

export default nextConfig;
