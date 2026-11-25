import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    // Fail instead of moving to another port: Compose's CORS setting allows only 5174.
    strictPort: true,
    // The token stylesheet is admin/src/tokens.css, a copy of web/src/tokens.css (DESIGN.md is the source).
    fs: { allow: ["."] },
  },
});
