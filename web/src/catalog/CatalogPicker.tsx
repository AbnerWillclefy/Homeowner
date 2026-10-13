import { DoorOpen, Plus } from "lucide-react";
import type { CatalogEntry } from "./api";
import type { Failure } from "../chores/api";
import { ChoreFacts } from "../chores/ChoreFacts";
import { CategoryTile, Fact, FactIcon } from "../chores/FactList";
import { groupByCategory } from "../chores/groups";
import { categoryLabel, labelText } from "../profile/labels";
import { AppDialog } from "../shared/ui/AppDialog";
import { Card } from "../shared/ui/Card";
import { GroupHeading } from "../shared/ui/GroupHeading";
import { useI18n, type MessageKey } from "../shared/i18n";
import { Button } from "../shared/ui/Button";
import { catalogName } from "./name";
import { useCatalog } from "./useCatalog";

const LOAD_FAILURE_KEY: Record<Failure["kind"], MessageKey> = {
  offline: "chores.catalog.load.offline",
  error: "chores.catalog.load.error",
  "not-signed-in": "chores.notSignedIn",
};

interface Props {
  onPick(entry: CatalogEntry): void;
  onClose(): void;
}

/**
 * The Catalog's Chores to pick from in a near-full-height dialog, grouped by Category and drawn like the Chores
 * tab's cards. Picking one hands it on to be pre-filled and saved like any new Chore; the parent opens that form
 * over this dialog, so cancelling it returns here where the Resident left off.
 */
export function CatalogPicker({ onPick, onClose }: Props) {
  const { t } = useI18n();
  const { state, reload } = useCatalog();

  return (
    <AppDialog
      size="sheet"
      title={t("chores.catalog.heading")}
      onDismiss={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("chores.catalog.close")}
        </Button>
      }
    >
      <div className="mt-6 flex flex-col gap-8">
        {state.kind === "loading" && (
          <p role="status" className="my-0 text-muted">
            {t("chores.catalog.loading")}
          </p>
        )}

        {state.kind === "failed" && (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="my-0 text-danger">
              {t(LOAD_FAILURE_KEY[state.reason])}
            </p>
            {state.reason !== "not-signed-in" && (
              <Button variant="secondary" onClick={reload}>
                {t("chores.retry")}
              </Button>
            )}
          </div>
        )}

        {state.kind === "ready" &&
          groupByCategory(state.entries, []).map((group) => (
            <section key={group.category} aria-labelledby={`catalog-${group.category}`} className="mt-0">
              <GroupHeading count={group.chores.length} icon={<CategoryTile category={group.category} />}>
                <span id={`catalog-${group.category}`}>{labelText(t, categoryLabel(group.category))}</span>
              </GroupHeading>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {group.chores.map((entry) => (
                  <CatalogItem key={entry.id} entry={entry} onPick={() => onPick(entry)} />
                ))}
              </ul>
            </section>
          ))}
      </div>
    </AppDialog>
  );
}

/** One Catalog entry, as a Chore card: its name with Add, then its facts. */
function CatalogItem({ entry, onPick }: { entry: CatalogEntry; onPick(): void }) {
  const { t } = useI18n();
  const name = catalogName(entry.id, null, entry.name, t);
  return (
    <li className="my-0 list-none">
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h4 className="my-0 min-w-0 flex-1 text-lg font-bold leading-snug [overflow-wrap:anywhere]">{name}</h4>
          <Button variant="secondary" className="shrink-0" aria-label={t("chores.catalog.add.label", { name })} onClick={onPick}>
            <Plus size={20} aria-hidden="true" />
            {t("chores.catalog.add")}
          </Button>
        </div>
        <ChoreFacts chore={entry}>
          {entry.perRoom && <Fact icon={<FactIcon icon={DoorOpen} />}>{t("chores.catalog.perRoom")}</Fact>}
        </ChoreFacts>
      </Card>
    </li>
  );
}
