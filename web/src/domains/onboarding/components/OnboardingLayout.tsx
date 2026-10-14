import { ArrowLeft, ChevronDown } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { HealthBanner } from "../../../app/components/HealthBanner";
import { useI18n } from "../../../shared/i18n";
import { Settings } from "../../settings/components/Settings";
import { Button } from "../../../shared/ui/Button";

interface Props {
  /** This step's place in the walk, shown as a quiet "Step n of m" and a row of segments. */
  step: number;
  total: number;
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
 * Full-bleed onboarding screen: a soft static gradient, no nav. A top bar with Back and the progress segments, a
 * scrolling body anchored to the top so the question sits in the same place on every step, Settings tucked at the
 * end of the body, and an action area stuck to the bottom so the buttons stay reachable at the largest text size.
 */
export function OnboardingLayout({
  step,
  total,
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
        <div className="onboarding-x-bar flex min-h-14 items-center gap-2">
          {onBack ? (
            <BarButton
              label={t("onboarding.back")}
              disabled={disabled}
              onClick={onBack}
            >
              <ArrowLeft aria-hidden="true" />
            </BarButton>
          ) : (
            <span aria-hidden="true" className="size-11 shrink-0" />
          )}
          <ol aria-hidden="true" className="m-0 flex flex-1 gap-1.5 p-0">
            {Array.from({ length: total }, (_, index) => (
              <li
                key={index}
                className={`m-0 h-1.5 flex-1 list-none rounded-pill ${index < step ? "bg-accent" : "bg-border/30"}`}
              />
            ))}
          </ol>
          <span aria-hidden="true" className="size-11 shrink-0" />
        </div>

        <div className="onboarding-x flex flex-1 flex-col pt-6 pb-4">
          <p className="m-0 text-sm text-muted">{t("onboarding.progress", { step, total })}</p>
          <h1
            id="onboarding-heading"
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 text-balance focus:outline-none"
          >
            {heading}
          </h1>
          <div className="mt-4 [&>section]:mt-0">{children}</div>
          {failure && (
            <div
              role="alert"
              className="mt-4 flex flex-col items-center gap-2 text-center"
            >
              <p className="text-danger">{failure.message}</p>
              <Button
                variant="secondary"
                disabled={disabled}
                onClick={failure.onRetry}
              >
                {t("onboarding.retry")}
              </Button>
            </div>
          )}
          <details className="group mt-auto pt-10 text-sm">
            <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 px-3 text-muted [&::-webkit-details-marker]:hidden">
              {t("settings.heading")}
              <ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
            </summary>
            <Settings />
          </details>
        </div>

        {actions && (
          <div className="onboarding-x sticky bottom-0 flex flex-col gap-3 bg-welcome-to pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-linear-to-b before:from-transparent before:to-welcome-to before:content-['']">
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
    <Button
      variant="ghost"
      icon
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
