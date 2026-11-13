import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { AuthContext, type Auth } from "./auth/AuthContext";
import { I18nProvider } from "./shared/i18n/I18nProvider";
import { LOCALE_STORAGE_KEY, type Locale } from "./shared/i18n/i18n";
import { ThemeProvider } from "./shared/theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "./shared/theme/theme";

/** Renders a screen the way main.tsx does, in a locale and theme. Returns the auth spies. */
export function renderApp(node: ReactNode, options: { locale?: Locale; theme?: "light" | "dark"; path?: string; signedIn?: boolean } = {}) {
  const { locale = "pt-BR", theme = "dark", path = "/", signedIn = true } = options;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  const auth: Auth = { signedIn, signIn: vi.fn(async () => null), signOut: vi.fn() };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ThemeProvider>
          <AuthContext value={auth}>
            <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
          </AuthContext>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
  return { ...view, auth, client };
}
