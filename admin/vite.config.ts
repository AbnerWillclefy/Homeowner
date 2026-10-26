import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    // Fail instead of moving to another port: Compose's CORS setting allows only 5174.
    strictPort: true,
    // The token stylesheet lives in web/src/tokens.css (DESIGN.md is the single source).
    fs: { allow: [".", "../web/src"] },
  },
});
