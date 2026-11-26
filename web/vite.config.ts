import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { parsePolicy } from "./src/domains/auth/logic/passwordPolicy.ts";

/** Fails `vite build` when the password policy is unset or malformed, instead of shipping an app that throws on load. */
function requirePasswordPolicy(): Plugin {
  let raw: string | undefined;
  return {
    name: "require-password-policy",
    apply: "build",
    configResolved(resolved) {
      raw = loadEnv(resolved.mode, resolved.envDir || process.cwd(), "VITE_").VITE_PASSWORD_POLICY;
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
 * Preloads every latin Inter woff2 in the bundle by its hashed name, so text does not wait for the CSS to name the
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
          /(^|\/)inter-latin-\d+-normal-[^/]*\.woff2$/.test(name),
        );
        if (fonts.length === 0) {
          throw new Error(
            "preload-fonts: no built file matches inter-latin-<weight>-normal-*.woff2. Bedrock's tokens.css should import @fontsource/inter/<weight>.css.",
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
      const raw = loadEnv(resolved.mode, resolved.envDir || process.cwd(), "VITE_").VITE_API_BASE_URL;
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

/**
 * The app's name in index.html (title, iOS home-screen name) and the manifest. A staging build's says so, because its
 * CloudFront URL is random; its deploy also swaps in the amber icons from staging-icons/.
 */
function nameOf(app: string, mode: string): string {
  return loadEnv(mode, process.cwd(), "VITE_").VITE_ENVIRONMENT === "staging" ? `${app} Staging` : app;
}

function htmlName(name: string): Plugin {
  // pre: before Vite's own %ENV% replacement.
  return { name: "html-name", transformIndexHtml: { order: "pre", handler: (html) => html.replaceAll("%APP_NAME%", name) } };
}

export default defineConfig(({ mode }) => {
  const name = nameOf("Homeowner", mode);
  return {
    // Writes dist/.vite/manifest.json, which scripts/check-bundle-budget.mjs reads.
    build: { manifest: true },
    plugins: [
      htmlName(name),
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
          // Bedrock imports every Inter subset; only latin is precached, so the first install stays small.
          globIgnores: ["**/inter-{cyrillic,greek,vietnamese,latin-ext}-*.woff2"],
        },
        includeAssets: ["apple-touch-icon.png"],
        manifest: {
          name,
          short_name: name,
          description: "Share the housework fairly.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          // Static, so they cannot follow the in-app theme: they take Bedrock's dark `bg`, the default, so a light-theme
          // launch shows a brief dark splash.
          background_color: "#0e1110",
          theme_color: "#0e1110",
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
  };
});
