import { useI18n } from "../../../shared/i18n";
import type { Explanation } from "../api/api";

/**
 * Why the Resident's day looks the way it does, under the greeting. The text is server data in both languages, so
 * it is picked by Locale and never passed through the catalog. A plain paragraph on purpose: screen readers meet
 * it in reading order, it is not a live region (it does not change after load), and it has no heading of its
 * own, so there is no label to translate. Nothing renders when there is no explanation.
 */
export function DayExplanation({ explanation }: { explanation: Explanation | null | undefined }) {
  const { locale } = useI18n();
  const text = explanation?.text[locale].trim();
  if (!text) return null;
  return <p className="mt-0 mb-6 text-muted">{text}</p>;
}
