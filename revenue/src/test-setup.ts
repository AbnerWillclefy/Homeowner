import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only unmounts between tests by itself when vitest globals are on.
afterEach(cleanup);

// jsdom lacks these; Radix and vaul call them.
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.scrollIntoView ??= () => {};
window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
