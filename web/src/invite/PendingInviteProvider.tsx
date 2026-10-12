import { createContext, useContext, type ReactNode } from "react";
import { usePendingInvite } from "./usePendingInvite";

type PendingInvite = ReturnType<typeof usePendingInvite>;

const PendingInviteContext = createContext<PendingInvite | null>(null);

/**
 * Holds the Invite token for the whole app. It must render ABOVE the router: capturing the token strips the
 * `#invite=` fragment from the address with history.replaceState, and the router reads the location on its first
 * render, so the strip has to happen before that. The token never goes into router state or a query string.
 */
export function PendingInviteProvider({ children }: { children: ReactNode }) {
  const invite = usePendingInvite();
  return <PendingInviteContext.Provider value={invite}>{children}</PendingInviteContext.Provider>;
}

export function useInvite(): PendingInvite {
  const value = useContext(PendingInviteContext);
  if (value === null) throw new Error("useInvite needs PendingInviteProvider");
  return value;
}
