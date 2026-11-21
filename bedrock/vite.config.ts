import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Used only by the showcase; the package itself ships source, not a build.
export default defineConfig({
  root: "showcase",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist-showcase", emptyOutDir: true },
  server: { port: 5175, strictPort: true },
});
