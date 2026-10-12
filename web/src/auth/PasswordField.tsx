import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { flushSync } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "../i18n";
import { Button } from "../shared/ui/Button";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "defaultValue" | "value" | "onChange" | "ref">;

/**
 * A password input with an icon button, on the same row, that shows or hides what is typed. The
 * label stays in the screen (`<label htmlFor>`); every other input attribute is passed through.
 * The input stays uncontrolled and is never remounted, so toggling cannot lose the typed value.
 */
export function PasswordField(props: Props) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The screens own onSubmit, so listen on the form: a submit puts the field back to hidden.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const hide = () => setShown(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  function toggle() {
    const input = inputRef.current;
    const start = input?.selectionStart ?? null;
    const end = input?.selectionEnd ?? null;
    // Commit the type change now: some browsers reset the caret when it changes, so put it back after.
    flushSync(() => setShown(!shown));
    if (input && start !== null && end !== null && document.activeElement === input) {
      input.setSelectionRange(start, end);
    }
  }

  const Icon = shown ? EyeOff : Eye;

  return (
    <div className="flex items-end gap-x-2">
      <input
        {...props}
        ref={inputRef}
        type={shown ? "text" : "password"}
        autoCapitalize={shown ? "none" : props.autoCapitalize}
        autoCorrect={shown ? "off" : props.autoCorrect}
        spellCheck={shown ? false : props.spellCheck}
        className="min-w-0 flex-1"
      />
      {/* A mousedown would move focus off the input; keyboard users still reach the button by Tab. */}
      <Button
        variant="secondary"
        icon
        className="shrink-0"
        aria-label={t("auth.showPassword")}
        aria-pressed={shown}
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
      >
        <Icon aria-hidden="true" size={20} className="shrink-0" />
      </Button>
    </div>
  );
}
