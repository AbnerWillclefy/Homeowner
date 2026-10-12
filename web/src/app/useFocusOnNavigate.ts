import { useEffect, useRef, type RefObject } from "react";

/**
 * Declarative routing does not move focus, so a screen reader would not hear the new tab. After the path changes,
 * focus lands on the tab's heading. A tab still loading shows no heading yet: focus then lands on the container,
 * which is given `fallbackLabel` as its name so it is not announced as an unnamed element.
 * Does nothing on first render.
 */
export function useFocusOnNavigate(container: RefObject<HTMLElement | null>, pathname: string, fallbackLabel: string) {
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const root = container.current;
    if (!root) return;
    const heading = root.querySelector<HTMLElement>("h2");
    const target = heading ?? root;
    if (!heading) {
      root.setAttribute("role", "group");
      root.setAttribute("aria-label", fallbackLabel);
    }
    target.setAttribute("tabindex", "-1");
    target.focus();
  }, [container, pathname, fallbackLabel]);
}
