import { useState } from "react";
import { useNavigate } from "react-router";
import { useShell } from "../../../app/components/ShellContext";
import { ME_PATH } from "../../../app/logic/routes";
import type { MessageKey } from "../../../shared/i18n";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import { setName, type SetNameResult } from "../api/api";
import { checkName, NAME_MAX, type NameCheck } from "../logic/nameRules";

/** The words for each way a save can fail; `ok` has none. */
const PROBLEM_KEY: Record<Exclude<SetNameResult["kind"], "ok">, MessageKey> = {
  too_long: "profile.name.tooLong",
  invalid: "profile.name.invalid",
  offline: "profile.name.offline",
  error: "profile.name.error",
  "not-signed-in": "profile.name.notSignedIn",
};

/**
 * The state of the name field on the edit screen. The typed value is never reset by a failure, so a retry sends
 * exactly what was typed. The length is checked on every keystroke with the server's own rule, so a name that is
 * too long is stopped before any request; the API's `too_long` and `invalid` answers are shown the same way.
 * On success the User the API answered goes into the shell (so Me and Today's greeting change with no reload),
 * the Residents list is refreshed (the name is shown to housemates) and the screen returns to Me.
 */
export function useNameForm(initial: string) {
  const { me, residents } = useShell();
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  const [problem, setProblem] = useState<MessageKey | null>(null);

  const check: NameCheck = checkName(value);
  const tooLong = check.kind === "too_long";

  const save = useSubmitOnce(async () => {
    if (check.kind === "too_long") return;
    const result = await setName(check.kind === "ok" ? check.name : null);
    if (result.kind === "ok") {
      me.set(result.me);
      residents.reload();
      void navigate(ME_PATH);
      return;
    }
    setProblem(PROBLEM_KEY[result.kind]);
  });

  return {
    value,
    change(next: string) {
      setValue(next);
      setProblem(null);
    },
    count: check.count,
    max: NAME_MAX,
    /** What to tell the person, if anything: the local length check first, then the API's answer. */
    problem: tooLong ? PROBLEM_KEY.too_long : problem,
    canSave: !tooLong,
    saving: save.pending,
    submit() {
      void save.run();
    },
  };
}
