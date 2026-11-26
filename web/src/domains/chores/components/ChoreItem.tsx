import { ChevronRight } from "lucide-react";
import { Row } from "@homeowner/bedrock";
import { ChoreIcon } from "@homeowner/bedrock/home";
import type { Chore } from "../api/api";
import { useShell } from "../../../app/components/ShellContext";
import { useI18n } from "../../../shared/i18n";
import { choreCategory } from "../logic/choreCategory";
import { choreRowMeta } from "../logic/facts";

/**
 * One Chore in the list, as the `hm-item` of the Chores artboard: the Category's tile in its `chore-*` colour (its
 * group's heading names it), the name and a line of facts, each cut to one line (the Sheet shows them whole). Built on Bedrock's `Row`. A tap opens the Chore's Sheet, where it is edited or deleted. The Responsible Resident comes from the
 * Shell's shared list and is left out for Nobody, for a Resident who left and while the list loads.
 */
export function ChoreItem({ chore, onOpen }: { chore: Chore; onOpen(): void }) {
  const { t } = useI18n();
  const { residents } = useShell();
  const resident = chore.responsibleResidentId ? residents.byResidentId(chore.responsibleResidentId) : undefined;
  const category = choreCategory(chore.category);
  return (
    <Row
      asChild
      leading={<ChoreIcon size="md" category={category} />}
      title={chore.name}
      caption={choreRowMeta(chore, t, resident ? (resident.you ? t("home.residents.you") : resident.name) : null)}
      trailing={<ChevronRight size={20} aria-hidden="true" className="text-muted" />}
    >
      <button type="button" onClick={onOpen} />
    </Row>
  );
}
