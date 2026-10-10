function readApiBaseUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    throw new Error(
      "VITE_API_BASE_URL is not set. Copy web/.env.example to web/.env.local, or set it in the build environment.",
    );
  }
  const url = value.replace(/\/+$/, "");

  const { protocol, hostname } = new URL(url);
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  if (protocol === "http:" && !isLocal) {
    console.warn(`VITE_API_BASE_URL uses http: for ${hostname}; browsers block it from an https: page.`);
  }
  return url;
}

export const config = {
  apiBaseUrl: readApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
} as const;
