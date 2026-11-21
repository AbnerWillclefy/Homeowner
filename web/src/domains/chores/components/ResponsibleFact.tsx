import { useShell } from "../../../app/components/ShellContext";
import { useI18n } from "../../../shared/i18n";
import { Avatar } from "../../residents/components/Avatar";
import { Fact } from "./FactList";

/**
 * Who a Chore is reserved for, with their face and name from the Shell's shared Residents list. Nothing for Nobody,
 * for a Resident the list does not hold (they left), and while the list loads or has failed.
 */
export function ResponsibleFact({ residentId }: { residentId: string | null }) {
  const { t } = useI18n();
  const { residents } = useShell();
  const resident = residentId ? residents.byResidentId(residentId) : undefined;
  if (!resident) return null;
  return (
    <Fact icon={<Avatar resident={resident} />}>
      <span className="[overflow-wrap:anywhere]">{t("chores.item.responsible", { name: resident.you ? t("home.residents.you") : resident.name })}</span>
    </Fact>
  );
}
