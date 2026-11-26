import type { Home, HomeSettings, UpdateHomeResult } from "../api/api";
import type { MessageKey } from "../../../shared/i18n";
import type { UndoableChange } from "../../../shared/undo/useUndoable";
import { fieldErrorKey } from "./fieldErrors";
import { SETTINGS_FAILURE_KEY } from "./failureMessages";

const TITLE_KEY: Record<keyof HomeSettings, MessageKey> = {
  timezone: "home.settings.undo.timezone",
  allocationTime: "home.settings.undo.allocationTime",
};

interface Deps {
  /** `PUT /home`, which takes both fields every time. */
  update(settings: HomeSettings): Promise<UpdateHomeResult>;
  /** Puts a Home in the cache: what the screen shows. */
  show(home: Home): void;
}

/**
 * One change to a Home setting, sent at once, with Desfazer writing the old value back. `previous` is the whole Home as
 * it was when the change was made, so Desfazer sends both previous fields, never a merge into whatever is cached by
 * then (that would also undo a change to the other field made in between).
 */
export function settingsChange(previous: Home, field: keyof HomeSettings, value: string, { update, show }: Deps): UndoableChange {
  const next: Home = { ...previous, [field]: value };
  const settingsOf = ({ timezone, allocationTime }: Home): HomeSettings => ({ timezone, allocationTime });
  let refusal: MessageKey = SETTINGS_FAILURE_KEY.error;
  const write = async (settings: HomeSettings) => {
    const result = await update(settings);
    if (result.kind === "ok") show(result.home);
    else if (result.kind === "invalid") {
      const [[name, code] = ["", ""]] = Object.entries(result.fields);
      refusal = fieldErrorKey(name, code);
    } else refusal = SETTINGS_FAILURE_KEY[result.kind === "none" ? "error" : result.kind];
    return result;
  };
  return {
    key: "home-settings",
    titleKey: TITLE_KEY[field],
    get failedKey() {
      return refusal;
    },
    apply: () => show(next),
    revert: () => show(previous),
    send: () => write(settingsOf(next)),
    sendRevert: () => write(settingsOf(previous)),
  };
}
