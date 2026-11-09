import { Mic } from "lucide-react";
import { LazyDialog } from "../../../app/components/LazyPage";
import { lazyNamed } from "../../../app/lazyWithReload";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useVoice } from "../hooks/useVoice";

// Only this button is in the first load; the panel comes with the first tap.
const VoicePanel = lazyNamed(() => import("./VoicePanel"), "VoicePanel");

/** The top bar's microphone. The caller shows it only where the browser has speech recognition. */
export function MicButton() {
  const { t } = useI18n();
  const voice = useVoice();
  return (
    <>
      <Button variant="ghost" icon aria-label={t("voice.mic")} onClick={voice.open}>
        <Mic aria-hidden="true" size={20} />
      </Button>
      {voice.isOpen && (
        <LazyDialog>
          <VoicePanel voice={voice} />
        </LazyDialog>
      )}
    </>
  );
}
