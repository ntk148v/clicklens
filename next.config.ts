import type { NextConfig } from "next";
import packageJson from "./package.json";
import { execSync } from "child_process";

let gitCommit = "";
let gitTag = "";

try {
  gitCommit = execSync("git rev-parse --short HEAD", { stdio: "pipe" })
    .toString()
    .trim();
  gitTag = execSync("git describe --tags --abbrev=0", { stdio: "pipe" })
    .toString()
    .trim();
} catch (e) {
  // Ignore errors if not in a git repository or git is not installed
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version,
    NEXT_PUBLIC_GIT_COMMIT: process.env.NEXT_PUBLIC_GIT_COMMIT || gitCommit,
    NEXT_PUBLIC_GIT_TAG: process.env.NEXT_PUBLIC_GIT_TAG || gitTag,
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
