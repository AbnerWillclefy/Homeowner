import { useShell } from "../../../app/components/ShellContext";
import { useI18n } from "../../../shared/i18n";
import type { Resident } from "../api/api";
import { Avatar } from "./Avatar";

interface Props {
  /** The id the Day Plan uses for a Resident. */
  residentId: string;
  /** The words next to the Avatar, given the Resident (undefined while unknown). The default is the shown name. */
  label?: (resident: Resident | undefined) => string;
}

/**
 * A Resident as the Day Plan names them: a small Avatar and their name, looked up in the Shell's shared list.
 * While the list loads, after it failed, or for an unknown id, it shows the neutral Avatar and a placeholder
 * name in the same box, so nothing jumps. The name wraps and is never cut.
 */
export function ResidentLabel({ residentId, label }: Props) {
  const { t } = useI18n();
  const resident = useShell().residents.byResidentId(residentId);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar resident={resident ?? null} />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {label ? label(resident) : (resident?.name ?? t("dayplan.others.someone"))}
      </span>
    </span>
  );
}
