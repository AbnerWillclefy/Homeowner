import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { parsePolicy } from "./src/auth/passwordPolicy.ts";

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

export default defineConfig({
  plugins: [
    requirePasswordPolicy(),
    react(),
    tailwindcss(),
    VitePWA({
      // A deploy replaces the app shell on next load instead of stranding users on an old one.
      registerType: "autoUpdate",
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
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Service worker only in the production build.
      devOptions: { enabled: false },
    }),
  ],
});
