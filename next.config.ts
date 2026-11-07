import type { NextConfig } from "next";

const config: NextConfig = {
  turbopack: { root: process.cwd() },
  devIndicators: false,
  allowedDevOrigins: ["pistol.tamthai.de"],
  rewrites: () => [
    { source: "/context", destination: "/context-demo/index.html" },
    { source: "/context/autopilot", destination: "/context-demo/flow.html" },
    { source: "/context/issues", destination: "/context-demo/records.html" },
    { source: "/context/issues/new", destination: "/context-demo/records.html" },
    { source: "/context/issues/:id", destination: "/context-demo/records.html" },
  ],
};


export default config;
