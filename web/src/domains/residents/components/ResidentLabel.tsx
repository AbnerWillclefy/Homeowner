import type { ReactNode } from "react";
import { useI18n } from "../../../shared/i18n";
import { useResidentView } from "../hooks/useResidentView";
import { Avatar } from "./Avatar";

interface Props {
  /** The id the Day Plan uses for a Resident. */
  residentId: string;
  /**
   * The words next to the Avatar, given the Resident's shown name (or null while it is unknown). The default is
   * the name itself, or "A housemate" while unknown.
   */
  children?: (name: string | null, isMe: boolean) => ReactNode;
}

/**
 * A Resident as the Day Plan names them: a small Avatar and their name, looked up in the Shell's shared list.
 * While the list loads, after it failed, or for an unknown id, it shows the neutral Avatar and a placeholder
 * name in the same box, so nothing jumps. The name wraps and is never cut.
 */
export function ResidentLabel({ residentId, children }: Props) {
  const { t } = useI18n();
  const { resident } = useResidentView(residentId);
  const name = resident?.name ?? null;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name ?? ""} userId={resident?.userId ?? ""} photoUrl={resident?.photoUrl ?? null} size="sm" />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {children ? children(name, resident?.me ?? false) : (name ?? t("dayplan.others.someone"))}
      </span>
    </span>
  );
}
