import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { BanksStep } from "./components/BanksStep";
import { CredentialsStep } from "./components/CredentialsStep";
import { DoneStep } from "./components/DoneStep";
import { IncomeStep } from "./components/IncomeStep";
import { markOnboardingDone } from "./logic/onboardingDone";

const STEPS = 4;

/**
 * The first-run flow at `/onboarding`, outside the navigation: Pluggy credentials, banks, Monthly income, done. Each step says
 * why it is asked and can be skipped; the same actions live on Sources and Settings. Finishing writes the flag and opens the Overview.
 */
export function OnboardingPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const card = useRef<HTMLDivElement>(null);

  // A new step replaces the old one's buttons, so focus would fall to the page: put it on the new heading.
  useEffect(() => {
    card.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus();
  }, [step]);

  const next = () => setStep((s) => Math.min(STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));
  const finish = () => {
    markOnboardingDone();
    void navigate("/", { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[35rem] flex-col gap-6 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span className="section-title text-brand">{t("app.name")}</span>
        <span className="body text-text-muted">{t("onboarding.step", { n: step, total: STEPS })}</span>
      </header>
      <main id="main" className="flex flex-col gap-6">
        <div aria-hidden className="flex gap-2">
          {Array.from({ length: STEPS }, (_, i) => (
            <i key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-brand" : "bg-surface-hover"}`} />
          ))}
        </div>
        <div ref={card} className="flex flex-col gap-6">
          {step === 1 && <CredentialsStep onNext={next} onSkip={next} />}
          {step === 2 && <BanksStep onBack={back} onNext={next} onSkip={next} onCredentials={() => setStep(1)} />}
          {step === 3 && <IncomeStep onBack={back} onNext={next} onSkip={next} />}
          {step === 4 && <DoneStep onBack={back} onFinish={finish} />}
        </div>
      </main>
    </div>
  );
}
