// Rejects absolute URLs ("https://evil.com"), protocol-relative URLs
// ("//evil.com"), and anything else that isn't a local, in-app path, to
// avoid open-redirect issues. Falls back to "/" for anything not local.
export function getSafeNextPath(nextPath?: string | null): string {
  if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    return nextPath;
  }

  return "/";
}
