import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { chunkRecovery } from "./app/lazyWithReload";
import { HealthProvider } from "./app/components/HealthProvider";
import { EnvironmentBadge } from "./app/components/EnvironmentBadge";
import { ToastProvider } from "./shared/ui/ToastProvider";
import { I18nProvider } from "./shared/i18n";
import { PendingInviteProvider } from "./domains/invite/components/PendingInviteProvider";
import { UndoProvider } from "./shared/undo/UndoProvider";
import { ThemeProvider } from "./shared/theme";
import { QueryClientProvider, type FetchQueryOptions } from "@tanstack/react-query";
import { createQueryClient } from "./shared/query/queryClient";
import { getBoot } from "./app/api/bootApi";
import { boot } from "./app/logic/boot";
import { launchReads } from "./app/logic/launchReads";
import { browserSession } from "./domains/auth/logic/browserSession";
import "./index.css";

// Vite fires this when a chunk or its CSS cannot be fetched (usually after a deploy). The first time, reload for the
// new version instead of throwing; the lazy screens use the same rule for a failed import.
window.addEventListener("vite:preloadError", (event) => chunkRecovery.onPreloadError(event));

// Module level, so StrictMode's double mount does not create two caches.
const queryClient = createQueryClient();

// Start Today's reads now, together, instead of one screen at a time as each answer lets the next one mount
// (ADR 0016). prefetchQuery never throws: a failure is stored on the query and the screen's own hook shows it.
const reads = launchReads(window.location.pathname, browserSession.load() !== null);
if (reads.length > 0) {
  // One /boot request answers them all; the reads below are served from it, or go to their own endpoint when
  // their section is missing or failed.
  void boot.start(() => getBoot());
}
for (const read of reads) {
  // Each member of the union is valid on its own; TypeScript cannot pick one overload for the union.
  void queryClient.prefetchQuery(read as FetchQueryOptions);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EnvironmentBadge environment={import.meta.env.VITE_ENVIRONMENT} />
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
                  {/* Inside the router (a tab change sends the held write) and the toast provider (Desfazer). */}
                  <UndoProvider>
                    <App />
                  </UndoProvider>
                </BrowserRouter>
              </HealthProvider>
            </PendingInviteProvider>
          </ToastProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
