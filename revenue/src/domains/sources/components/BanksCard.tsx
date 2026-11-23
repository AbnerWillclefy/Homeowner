import { Badge, Card } from "@homeowner/bedrock";
import { Check, TriangleAlert } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { BankItem } from "../api";
import { BankMark } from "./BankMark";
import { SourceRow } from "./SourceRow";

/** The connected banks, each with Ok or Reconectar and its product count. A bank that needs a new authorization is explained once; the button to redo it is not built (the connect-token route takes no Item). */
export function BanksCard({ items }: { items: BankItem[] }) {
  const { t } = useI18n();
  return (
    <Card role="group" aria-labelledby="sources-banks">
      <h2 id="sources-banks" className="card-label text-text-muted">{t("sources.banks.title")}</h2>
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const name = item.bankName ?? t("sources.banks.unnamed");
          return (
            <li key={item.id}>
              <SourceRow
                leading={<BankMark name={name} />}
                title={name}
                subtitle={t(item.products === 1 ? "sources.banks.products.one" : "sources.banks.products.other", { n: item.products })}
                end={item.status === "ok" ? <Badge tone="positive" icon={Check}>{t("sources.banks.ok")}</Badge> : <Badge tone="warning" icon={TriangleAlert}>{t("sources.banks.reconnect")}</Badge>}
              />
            </li>
          );
        })}
      </ul>
      {items.some((i) => i.status === "reconnect") && <p className="text-text-muted">{t("sources.banks.reconnectNote")}</p>}
    </Card>
  );
}
