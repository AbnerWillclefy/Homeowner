import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { ToastProvider } from "./components/ui/ToastProvider";
import { I18nProvider } from "./i18n";
import { PendingInviteProvider } from "./invite/PendingInviteProvider";
import { ThemeProvider } from "./theme";
// Only the latin subset and the weights in use; the bare package would pull every subset.
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        {/* Before the router: capturing the Invite strips its #invite= fragment, and the router reads the
            location on its first render. */}
        <ToastProvider>
          <PendingInviteProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </PendingInviteProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
