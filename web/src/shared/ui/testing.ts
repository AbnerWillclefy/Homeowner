import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, vi } from "vitest";
import { enUS } from "../i18n/catalogs/en-US";
import { I18nContext, type I18n } from "../i18n/context";
import { createTranslate, type Catalogs } from "../i18n/translate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const translate = createTranslate({ "en-US": enUS, "pt-BR": enUS } as Catalogs);

const i18n: I18n = {
  locale: "en-US",
  setLocale: () => {},
  t: (key, params) => translate("en-US", key, params),
};

/**
 * Sets up a jsdom container and fake timers around each test, and returns `render`, which mounts a node under the
 * en-US i18n context inside `act`. Call it at the top of a `describe`; needs `@vitest-environment jsdom`.
 */
export function mountWithI18n(): { render(node: ReactNode): void; container(): HTMLElement } {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  return {
    render: (node) => act(() => root.render(createElement(I18nContext.Provider, { value: i18n }, node))),
    container: () => container,
  };
}
