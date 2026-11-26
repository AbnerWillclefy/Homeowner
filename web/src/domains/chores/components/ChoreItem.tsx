import { ChevronRight } from "lucide-react";
import { ChoreTag } from "@homeowner/bedrock/home";
import type { Chore } from "../api/api";
import { useShell } from "../../../app/components/ShellContext";
import { useI18n } from "../../../shared/i18n";
import { categoryLabel, labelText } from "../../profile/logic/labels";
import { choreCategory } from "../logic/choreCategory";
import { choreRowMeta } from "../logic/facts";

/**
 * One Chore in the list: the Category as a tag (its name as text, in its `chore-*` colour), the name and a line of
 * facts. A tap opens the Chore's Sheet, where it is edited or deleted. The Responsible Resident comes from the
 * Shell's shared list and is left out for Nobody, for a Resident who left and while the list loads.
 */
export function ChoreItem({ chore, onOpen }: { chore: Chore; onOpen(): void }) {
  const { t } = useI18n();
  const { residents } = useShell();
  const resident = chore.responsibleResidentId ? residents.byResidentId(chore.responsibleResidentId) : undefined;
  const category = choreCategory(chore.category);
  return (
    <li className="my-0 list-none border-t border-border/40 first:border-t-0">
      <button
        type="button"
        onClick={onOpen}
        className="grid min-h-16 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-0 bg-transparent px-4 py-3 text-left text-text hover:bg-surface-hover active:bg-surface-hover motion-safe:transition-colors motion-safe:duration-150"
      >
        <span className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
          <span className="font-semibold">{chore.name}</span>
          <ChoreTag size="sm" category={category} label={labelText(t, categoryLabel(category.id))} />
          <span className="text-sm text-muted">{choreRowMeta(chore, t, resident ? (resident.you ? t("home.residents.you") : resident.name) : null)}</span>
        </span>
        <ChevronRight size={20} aria-hidden="true" className="text-muted" />
      </button>
    </li>
  );
}
