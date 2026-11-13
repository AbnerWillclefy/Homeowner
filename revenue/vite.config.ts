import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    // Fail instead of moving to another port: Compose's CORS setting allows only 5175.
    strictPort: true,
  },
});
