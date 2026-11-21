import { Badge } from "@homeowner/bedrock";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatChange } from "../logic/change";

/** The change against the previous month. More spending is a warning tone, less or equal is neutral: spending less is never praised in colour. */
export function ChangeBadge({ percent }: { percent: number }) {
  const { t, locale } = useI18n();
  return <Badge tone={percent > 0 ? "warning" : "neutral"}>{t("categories.change.vs", { percent: formatChange(percent, locale) })}</Badge>;
}
