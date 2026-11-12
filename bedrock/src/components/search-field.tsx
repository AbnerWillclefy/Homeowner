import { Search, X } from "lucide-react";
import { useId, useRef } from "react";
import { fieldClass } from "./field";
import { cn } from "../lib/cn";

// Filters, tokens and suggestions are a later ticket: this is the text field and its clear button.
export function SearchField({
  label,
  clearLabel,
  value,
  onValueChange,
  placeholder,
}: {
  label: string;
  clearLabel: string;
  value: string;
  onValueChange: (text: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const clear = () => {
    onValueChange("");
    input.current?.focus();
  };
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
      <input
        ref={input}
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            clear();
          }
        }}
        // Hide WebKit's own cancel button, or there are two clear controls.
        className={cn(fieldClass(false), "rounded-full pl-10 pr-12 [&::-webkit-search-cancel-button]:appearance-none")}
      />
      {value && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={clear}
          className="absolute top-1/2 right-1 flex size-control-md -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:bg-surface-hover pointer-coarse:size-control-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}
