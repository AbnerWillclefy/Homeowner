import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./app/App";
import { AuthProvider } from "./auth/AuthContext";
import { I18nProvider } from "./shared/i18n/I18nProvider";
import { ThemeProvider } from "./shared/theme/ThemeProvider";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);
