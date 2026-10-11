import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "../../i18n";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "defaultValue" | "value" | "onChange" | "ref">;

/**
 * A password input with a button that shows or hides what is typed. The label stays in the
 * screen (`<label htmlFor>`); every other input attribute is passed through. The input stays
 * uncontrolled and is never remounted, so toggling cannot lose the typed value.
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

  const Icon = shown ? EyeOff : Eye;

  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <input
        {...props}
        ref={inputRef}
        type={shown ? "text" : "password"}
        autoCapitalize={shown ? "none" : props.autoCapitalize}
        autoCorrect={shown ? "off" : props.autoCorrect}
        spellCheck={shown ? false : props.spellCheck}
        className="min-w-48 flex-1 basis-48"
      />
      <button type="button" className="btn" aria-pressed={shown} onClick={() => setShown(!shown)}>
        <Icon aria-hidden="true" size={20} className="mr-2 shrink-0" />
        {t("auth.showPassword")}
      </button>
    </div>
  );
}
