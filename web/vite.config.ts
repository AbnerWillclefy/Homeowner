import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A deploy replaces the app shell on next load instead of stranding users on an old one.
      registerType: "autoUpdate",
      // Precache the app shell only. No runtime caching: API responses must never be served stale.
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        navigateFallback: "index.html",
      },
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Homeowner",
        short_name: "Homeowner",
        description: "Share the housework fairly.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#2f6f4f",
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
