import { Component, type ComponentType, type ReactNode } from "react";
import { useI18n } from "../../shared/i18n";
import { Button } from "../../shared/ui/Button";
import { isChunkLoadError } from "../logic/chunkReload";

interface Props {
  children: ReactNode;
  /** Wraps the alert in the screen's own frame, for a screen that has none around the boundary (onboarding). */
  frame?: ComponentType<{ children: ReactNode }>;
  /** Show nothing when the code cannot load, for a dialog that is better absent than broken. */
  quiet?: boolean;
}

function ChunkFailed({ frame: Frame }: { frame?: ComponentType<{ children: ReactNode }> }) {
  const { t } = useI18n();
  const alert = (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="my-0">{t("app.chunkFailed")}</p>
      <Button variant="secondary" onClick={() => window.location.reload()}>
        {t("app.chunkRetry")}
      </Button>
    </div>
  );
  return Frame ? <Frame>{alert}</Frame> : alert;
}

/**
 * Catches a screen whose code could not load even after the one automatic reload (see lazyWithReload), and shows a
 * calm alert with Retry in the screen's place. Nothing else in the app is affected: the tabs stay. One boundary
 * per lazy element, keyed by the route, so moving to another tab clears it.
 *
 * Only chunk-load failures are shown here. Any other error is thrown again from render, so it reaches the next
 * boundary up (or the console) instead of hiding behind a "could not be loaded" alert.
 */
export class ChunkErrorBoundary extends Component<Props, { error: unknown; failed: boolean }> {
  state = { error: null as unknown, failed: false };

  static getDerivedStateFromError(error: unknown) {
    return { error, failed: isChunkLoadError(error) };
  }

  render() {
    if (this.state.error !== null && !this.state.failed) throw this.state.error;
    if (!this.state.failed) return this.props.children;
    if (this.props.quiet) return null;
    return <ChunkFailed frame={this.props.frame} />;
  }
}
