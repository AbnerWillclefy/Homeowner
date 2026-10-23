import { ScrollText, Sparkles, type LucideIcon } from "lucide-react";
import type { MessageKey } from "../../../shared/i18n";
import type { Explanation } from "../api/api";

/** The small icon and the wording that say who wrote an explanation. Neutral for both: neither source is a failure. */
export const EXPLANATION_SOURCES = {
  llm: { icon: Sparkles, labelKey: "dayplan.summary.source.llm" },
  template: { icon: ScrollText, labelKey: "dayplan.summary.source.template" },
} as const satisfies Record<Explanation["source"], { icon: LucideIcon; labelKey: MessageKey }>;
