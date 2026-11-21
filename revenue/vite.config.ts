import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A deploy replaces the app shell on next load instead of stranding Users on an old one.
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      // A custom worker (src/sw.ts) holds the push handlers. It precaches the app shell only;
      // no runtime caching, so Finances data is never stored or served stale.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: { globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"] },
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Revenue",
        short_name: "Revenue",
        description: "Your household finances.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // Static, so they cannot follow the in-app theme: Bedrock's dark surface (--neutral-9).
        background_color: "#161a19",
        theme_color: "#161a19",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5175,
    // Fail instead of moving to another port: Compose's CORS setting allows only 5175.
    strictPort: true,
  },
});
