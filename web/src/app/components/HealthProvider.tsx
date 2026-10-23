import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useHealth } from "../hooks/useHealth";

type Health = ReturnType<typeof useHealth>;

const HealthContext = createContext<Health | null>(null);

/**
 * Runs the server check once per app load. Mounted above the router in main.tsx, so no layout change of the Guard
 * can remount it: the banners of the page and onboarding layouts only read what it holds.
 */
export function HealthProvider({ children }: { children: ReactNode }) {
  const { state, retry } = useHealth();
  const value = useMemo(() => ({ state, retry }), [state, retry]);
  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealthStatus(): Health {
  const value = useContext(HealthContext);
  if (value === null) throw new Error("useHealthStatus needs HealthProvider");
  return value;
}
