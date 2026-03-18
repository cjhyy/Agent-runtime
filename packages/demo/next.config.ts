import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@agent-runtime/server",
    "@agent-runtime/agent",
    "@agent-runtime/core",
    "@agent-runtime/browser",
    "@agent-runtime/mcp-playwright",
    "@agent-runtime/mcp-sdk-bridge",
    "@modelcontextprotocol/sdk",
    "mem-deep-research",
    "ws",
    "playwright",
    "playwright-core",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
    "kind-of",
    "shallow-clone",
    "is-plain-object",
  ],
};

export default nextConfig;
