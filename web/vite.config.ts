import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {
  defineConfig,
  loadEnv,
  type HtmlTagDescriptor,
  type Plugin,
} from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { parsePolicy } from "./src/domains/auth/logic/passwordPolicy.ts";

/** Fails `vite build` when the password policy is unset or malformed, instead of shipping an app that throws on load. */
function requirePasswordPolicy(): Plugin {
  let raw: string | undefined;
  return {
    name: "require-password-policy",
    apply: "build",
    configResolved(resolved) {
      raw = loadEnv(
        resolved.mode,
        resolved.envDir || process.cwd(),
        "VITE_",
      ).VITE_PASSWORD_POLICY;
    },
    buildStart() {
      if (!raw?.trim()) {
        this.error(
          "VITE_PASSWORD_POLICY is not set. Copy web/.env.example to web/.env.local, or set it in the build environment.",
        );
      }
      try {
        parsePolicy(raw);
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
    },
  };
}

/**
 * Preloads every latin Nunito woff2 in the bundle by its hashed name, so text does not wait for the CSS to name the
 * file and change weight after first paint. Fails `vite build` when none is emitted, e.g. the package renamed them.
 */
function preloadFonts(): Plugin {
  return {
    name: "preload-fonts",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const fonts = Object.keys(ctx.bundle ?? {}).filter((name) =>
          /(^|\/)nunito-latin-\d+-normal-[^/]*\.woff2$/.test(name),
        );
        if (fonts.length === 0) {
          throw new Error(
            "preload-fonts: no built file matches nunito-latin-<weight>-normal-*.woff2. Import @fontsource/nunito/latin-<weight>.css in src/main.tsx.",
          );
        }
        return fonts.map((file): HtmlTagDescriptor => ({
          tag: "link",
          // crossorigin is required even for same-origin fonts, or the browser fetches the font twice.
          attrs: {
            rel: "preload",
            as: "font",
            type: "font/woff2",
            href: `/${file}`,
            crossorigin: "",
          },
          // Not head-prepend: the charset meta must stay within the first 1024 bytes.
          injectTo: "head",
        }));
      },
    },
  };
}

/** Warms the connection to the API origin. Skipped when `VITE_API_BASE_URL` is missing or not a URL. */
function preconnectApi(): Plugin {
  let origin: string | undefined;
  return {
    name: "preconnect-api",
    apply: "build",
    configResolved(resolved) {
      const raw = loadEnv(
        resolved.mode,
        resolved.envDir || process.cwd(),
        "VITE_",
      ).VITE_API_BASE_URL;
      try {
        origin = new URL(raw ?? "").origin;
      } catch {
        origin = undefined;
      }
    },
    transformIndexHtml() {
      if (!origin) return [];
      // crossorigin: API calls are CORS requests without credentials, which use the anonymous connection pool.
      return [
        {
          tag: "link",
          attrs: { rel: "preconnect", href: origin, crossorigin: "" },
          injectTo: "head",
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [
    requirePasswordPolicy(),
    preloadFonts(),
    preconnectApi(),
    react(),
    tailwindcss(),
    VitePWA({
      // A deploy replaces the app shell on next load instead of stranding users on an old one.
      registerType: "autoUpdate",
      // Same registerSW.js file name, but deferred so it does not block first paint.
      injectRegister: "script-defer",
      // A custom worker (src/sw.ts) holds the push handlers. It precaches the app shell only;
      // no runtime caching, so API responses are never served stale.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
      },
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Homeowner",
        short_name: "Homeowner",
        description: "Share the housework fairly.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // Static, so they cannot follow the in-app theme: a dark-mode launch shows a brief light splash.
        background_color: "#f7f8f5",
        theme_color: "#f7f8f5",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // Service worker only in the production build.
      devOptions: { enabled: false },
    }),
  ],
});
