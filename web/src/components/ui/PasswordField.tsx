import { useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "../../i18n";

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
  const caretRef = useRef<{ start: number; end: number } | null>(null);

  // The screens own onSubmit, so listen on the form: a submit puts the field back to hidden.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const hide = () => setShown(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  // Some browsers reset the caret when the type changes, so put it back after the switch.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const caret = caretRef.current;
    if (!input || !caret || document.activeElement !== input) return;
    input.setSelectionRange(caret.start, caret.end);
  }, [shown]);

  function toggle() {
    const input = inputRef.current;
    if (input && input.selectionStart !== null && input.selectionEnd !== null) {
      caretRef.current = { start: input.selectionStart, end: input.selectionEnd };
    }
    setShown(!shown);
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
      <button
        type="button"
        className="btn size-11 shrink-0 p-0"
        aria-label={t("auth.showPassword")}
        aria-pressed={shown}
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
      >
        <Icon aria-hidden="true" size={20} className="shrink-0" />
      </button>
    </div>
  );
}
