import { ArrowLeft } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { HealthBanner } from "../app/HealthBanner";
import { PillButton } from "../components/ui/PillButton";
import { useI18n } from "../i18n";
import { Settings } from "../settings/Settings";

interface Props {
  /** Quiet "Step n of m" label. */
  progress: string;
  /** The step's question: the page heading, focused on step change. */
  heading: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** Back in the top bar; absent where the step does not allow going back. */
  onBack?: () => void;
  /** The step's fields or action. */
  children: ReactNode;
  /** A failure message with its Try again action. */
  failure?: { message: string; onRetry: () => void };
  /** The bottom action area: continue and skip buttons. */
  actions?: ReactNode;
  disabled?: boolean;
}

/**
 * Full-bleed onboarding screen: a soft static gradient, no nav. A top bar with Back, a centred scrolling body with
 * the question and its body, and an action area stuck to the bottom so the buttons stay reachable at the largest
 * text size.
 */
export function OnboardingLayout({
  progress,
  heading,
  headingRef,
  onBack,
  children,
  failure,
  actions,
  disabled = false,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-linear-to-b from-welcome-from to-welcome-to pt-[env(safe-area-inset-top)] text-text">
      <div className="onboarding-x mx-auto w-full max-w-lg">
        <HealthBanner />
      </div>
      <main
        tabIndex={-1}
        className="mx-auto flex w-full max-w-lg flex-1 flex-col focus:outline-none"
        aria-labelledby="onboarding-heading"
      >
        <div className="onboarding-x-bar flex min-h-14 items-center justify-between gap-2">
          {onBack ? (
            <BarButton label={t("onboarding.back")} disabled={disabled} onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
            </BarButton>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>

        <div className="onboarding-x flex flex-1 flex-col justify-center gap-2 py-4">
          <p className="text-center text-sm text-muted">{progress}</p>
          <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1} className="text-center focus:outline-none">
            {heading}
          </h1>
          <div className="mt-4">{children}</div>
          {failure && (
            <div role="alert" className="mt-4 flex flex-col items-center gap-2 text-center">
              <p className="text-danger">{failure.message}</p>
              <PillButton variant="secondary" disabled={disabled} onClick={failure.onRetry}>
                {t("onboarding.retry")}
              </PillButton>
            </div>
          )}
          <details className="mt-6 text-sm">
            <summary className="min-h-11 cursor-pointer py-2 text-center">{t("settings.heading")}</summary>
            <Settings />
          </details>
        </div>

        {actions && (
          <div className="onboarding-x sticky bottom-0 flex flex-col gap-3 bg-welcome-to pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {actions}
          </div>
        )}
      </main>
    </div>
  );
}

function BarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill border border-transparent text-text motion-safe:transition-colors motion-safe:duration-150 disabled:text-muted"
    >
      {children}
    </button>
  );
}
