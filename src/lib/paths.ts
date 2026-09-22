/** App routes are relative to the Vite base (`/Materials-Tracking/`). */
export function appBasename() {
  return (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";
}

export function publicAsset(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

export function safeNextPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}

/** Absolute callback URL, including the GitHub Pages project base path. */
export function authCallbackUrl(nextPath: string) {
  const url = new URL(`${appBasename()}/auth/callback`, window.location.origin);
  url.searchParams.set("next", safeNextPath(nextPath));
  return url.toString();
}
