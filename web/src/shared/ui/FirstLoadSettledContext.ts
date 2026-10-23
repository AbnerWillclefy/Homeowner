import { createContext } from "react";

/**
 * The app's ear for "this page's first load has settled" (data or failure). A `PageLoading` calls it once per mount.
 * The default does nothing, so pages outside the app keep working unchanged.
 */
export const FirstLoadSettledContext = createContext<() => void>(() => {});
