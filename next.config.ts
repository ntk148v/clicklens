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
} catch {
  // Ignore errors if not in a git repository or git is not installed
}

const clicklensBasePath = (process.env.CLICKLENS_BASE_PATH ?? "")
  .trim()
  .replace(/\/$/, "");

const clicklensTrailingSlashRaw = (
  process.env.CLICKLENS_TRAILING_SLASH ?? ""
).toLowerCase();
const clicklensTrailingSlash =
  clicklensTrailingSlashRaw === "true" || clicklensTrailingSlashRaw === "1";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: clicklensBasePath || undefined,
  trailingSlash: clicklensTrailingSlash,
  env: {
    NEXT_PUBLIC_BASE_PATH: clicklensBasePath,
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
            value: "0",
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
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
