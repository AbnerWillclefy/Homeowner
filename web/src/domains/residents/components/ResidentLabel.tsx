import { useShell } from "../../../app/components/ShellContext";
import { useI18n } from "../../../shared/i18n";
import { withLine } from "../logic/withLine";
import { Avatar } from "./Avatar";

interface Props {
  /** The id the Day Plan uses for a Resident. */
  residentId: string;
  /** Write the name as a "With ..." line, as on a two-person Task ("With you" for the caller). */
  withLine?: boolean;
}

/**
 * A Resident as the Day Plan names them: a small Avatar and their name, looked up in the Shell's shared list.
 * While the list loads, after it failed, or for an unknown id, it shows the neutral Avatar and a placeholder
 * name in the same box, so nothing jumps. The name wraps and is never cut.
 */
export function ResidentLabel({ residentId, withLine: asWithLine = false }: Props) {
  const { t } = useI18n();
  const resident = useShell().residents.byResidentId(residentId);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar resident={resident ?? null} />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {asWithLine ? withLine(t, resident) : (resident?.name ?? t("dayplan.others.someone"))}
      </span>
    </span>
  );
}
