/**
 * Sub-path deployment support (must match `basePath` in `next.config.ts`).
 * `NEXT_PUBLIC_BASE_PATH` is set from `CLICKLENS_BASE_PATH` at build time.
 */
export function getBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (!raw || raw === "/") {
    return "";
  }
  return raw.replace(/\/$/, "");
}

/**
 * Prefix a root-relative path with the app base path for same-origin URLs.
 * Leaves absolute HTTP(S) URLs unchanged.
 */
export function withBasePath(path: string): string {
  if (
    !path ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("//")
  ) {
    return path;
  }
  const base = getBasePath();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!base) {
    return normalized;
  }
  return `${base}${normalized}`;
}
