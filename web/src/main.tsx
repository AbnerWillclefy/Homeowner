import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { I18nProvider } from "./i18n";
import { PendingInviteProvider } from "./invite/PendingInviteProvider";
import { ThemeProvider } from "./theme";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        {/* Before the router: capturing the Invite strips its #invite= fragment, and the router reads the
            location on its first render. */}
        <PendingInviteProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </PendingInviteProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
