import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { HealthProvider } from "./app/components/HealthProvider";
import { ToastProvider } from "./shared/ui/ToastProvider";
import { I18nProvider } from "./shared/i18n";
import { PendingInviteProvider } from "./domains/invite/components/PendingInviteProvider";
import { ThemeProvider } from "./shared/theme";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./shared/query/queryClient";
// Only the latin subset and the weights in use; the bare package would pull every subset.
// A weight added here must also be added to NUNITO_WEIGHTS in vite.config.ts, which preloads the files.
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "./index.css";

// Module level, so StrictMode's double mount does not create two caches.
const queryClient = createQueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        {/* Before the router: capturing the Invite strips its #invite= fragment, and the router reads the
            location on its first render. */}
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <PendingInviteProvider>
              {/* Above the router: nothing under it can remount the check, so /healthz is asked once per load. */}
              <HealthProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </HealthProvider>
            </PendingInviteProvider>
          </ToastProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
