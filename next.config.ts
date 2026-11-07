import type { NextConfig } from "next";

const config: NextConfig = {
  turbopack: { root: process.cwd() },
  devIndicators: false,
  rewrites: () => [{ source: "/context", destination: "/context-demo/index.html" }],
};

export default config;
