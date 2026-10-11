import { Check, Circle } from "lucide-react";
import type { RuleResult } from "../../auth/passwordPolicy";

interface Props {
  id: string;
  rules: RuleResult[];
}

/** The evaluated password rules as a checklist. Presentational: unmet is guidance, never an error. */
export function PasswordRules({ id, rules }: Props) {
  return (
    <ul id={id} className="my-1 list-none p-0 text-sm">
      {rules.map((rule) => {
        const Icon = rule.met ? Check : Circle;
        return (
          <li key={rule.id} className={`flex items-start gap-2 ${rule.met ? "text-accent" : "text-muted"}`}>
            <Icon aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
            <span>
              {rule.label}: {rule.met ? "Met" : "Not met yet"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
