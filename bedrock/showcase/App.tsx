import { useEffect, useState, type ComponentType } from "react";

export type Locale = "pt-BR" | "en";
type Theme = "dark" | "light";

// One file per component under sections/, so the parallel tickets never edit a shared list.
const modules = import.meta.glob<{ default: ComponentType<{ locale: Locale }> }>("./sections/*.tsx", {
  eager: true,
});
const sections = Object.entries(modules).sort(([a], [b]) => a.localeCompare(b));

const strings = {
  "pt-BR": { title: "Bedrock", theme: "Tema", dark: "Escuro", light: "Claro", locale: "Idioma", empty: "Nenhum componente ainda." },
  en: { title: "Bedrock", theme: "Theme", dark: "Dark", light: "Light", locale: "Language", empty: "No components yet." },
};

const params = new URLSearchParams(window.location.search);
const initialTheme: Theme = params.get("theme") === "light" ? "light" : "dark";
const initialLocale: Locale = params.get("locale") === "en" ? "en" : "pt-BR";

export function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = strings[locale];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
    const url = new URL(window.location.href);
    url.searchParams.set("theme", theme);
    url.searchParams.set("locale", locale);
    history.replaceState(null, "", url);
  }, [theme, locale]);

  const select = "h-control-md rounded-md border border-border-strong bg-surface px-2 body";

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface p-4">
        <h1 className="page-title">{t.title}</h1>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 label">
            {t.theme}
            <select className={select} value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              <option value="dark">{t.dark}</option>
              <option value="light">{t.light}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 label">
            {t.locale}
            <select className={select} value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              <option value="pt-BR">Português</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </header>
      <main className="mx-auto flex max-w-content flex-col gap-8 p-4">
        {sections.length === 0 && <p className="body text-text-muted">{t.empty}</p>}
        {/* data-section lets the ui-screenshots check find a section by its file name */}
        {sections.map(([path, { default: Section }]) => (
          <div key={path} data-section={path.slice("./sections/".length, -".tsx".length)}>
            <Section locale={locale} />
          </div>
        ))}
      </main>
    </>
  );
}
