import { Banner, Button } from "@homeowner/bedrock";
import { useEffect, useState } from "react";
import { useI18n } from "../shared/i18n/I18nProvider";
import { isDismissed, needsManualInstall, rememberDismissed, type BeforeInstallPromptEvent } from "./installPrompt";

/** Offers to install Revenue: Chromium's own prompt, or the Share steps on iOS. Dismissing hides it for the session. */
export function InstallBanner() {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(isDismissed);
  const [offer, setOffer] = useState<BeforeInstallPromptEvent | null>(null);
  const manual = needsManualInstall(navigator);

  useEffect(() => {
    const onOffer = (event: Event) => {
      event.preventDefault(); // Keep the event for our own button instead of Chromium's mini-infobar.
      setOffer(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onOffer);
    return () => window.removeEventListener("beforeinstallprompt", onOffer);
  }, []);

  if (dismissed || (!offer && !manual)) return null;
  const dismiss = () => {
    rememberDismissed();
    setDismissed(true);
  };
  return (
    <div className="p-4">
      <Banner
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {offer && (
              <Button
                size="sm"
                onClick={() => {
                  void offer.prompt();
                  dismiss();
                }}
              >
                {t("install.action")}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t("install.dismiss")}
            </Button>
          </div>
        }
      >
        {t(offer ? "install.message" : "install.ios")}
      </Banner>
    </div>
  );
}
