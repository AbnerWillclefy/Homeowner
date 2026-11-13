import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./app/App";
import { InstallBanner } from "./app/InstallBanner";
import { AuthProvider } from "./auth/AuthContext";
import { createChunkRecovery } from "./shared/chunkReload";
import { I18nProvider } from "./shared/i18n/I18nProvider";
import { ThemeProvider } from "./shared/theme/ThemeProvider";
import "./index.css";

// A chunk or its CSS that cannot be fetched (usually after a deploy) reloads the page once, for the new version.
const chunkRecovery = createChunkRecovery({
  // Read only inside the recovery's try blocks: touching sessionStorage can throw where storage is blocked.
  storage: {
    getItem: (key) => window.sessionStorage.getItem(key),
    setItem: (key, value) => window.sessionStorage.setItem(key, value),
    removeItem: (key) => window.sessionStorage.removeItem(key),
  },
  now: () => Date.now(),
  reload: () => window.location.reload(),
});
window.addEventListener("vite:preloadError", (event) => chunkRecovery.onPreloadError(event));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <InstallBanner />
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);
