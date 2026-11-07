import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { financeAccess } from "../../logic/financeAccess";
import { TODAY_PATH } from "../../logic/routes";
import { useShell } from "../ShellContext";

/** Gates the Finances route: the lazy page is only created for a User with the flag, so its chunk is never requested otherwise. */
export function FinanceRoute({ children }: { children: ReactNode }) {
  const access = financeAccess(useShell().me.state);
  if (access === "redirect") return <Navigate to={TODAY_PATH} replace />;
  return access === "render" ? children : null;
}
