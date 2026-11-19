import { useEffect, useRef } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";

// jsQR's cost grows with the frame, and a receipt QR is large in frame: 640px wide is plenty.
const MAX_WIDTH = 640;

/**
 * The camera preview, read frame by frame until a QR code decodes. A camera that cannot be used (denied, missing, not
 * a secure context) calls `onDenied`. Every track stops when it unmounts, or the camera light stays on.
 */
export function QrScanner({ onCode, onDenied }: { onCode(text: string): void; onDenied(): void }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  // The latest callbacks, so the camera is not restarted when the parent re-renders.
  const callbacks = useRef({ onCode, onDenied });
  callbacks.current = { onCode, onDenied };

  useEffect(() => {
    let stopped = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return callbacks.current.onDenied();
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        return callbacks.current.onDenied();
      }
      // Closed while the browser was asking for permission.
      if (stopped) return stop();
      const el = video.current;
      if (!el) return stop();
      el.srcObject = stream;
      await el.play().catch(() => {});
      let decode: typeof import("jsqr").default;
      try {
        ({ default: decode } = await import("jsqr"));
      } catch {
        // Offline, or a deploy replaced the chunk: same as an unusable camera.
        stop();
        return callbacks.current.onDenied();
      }
      const canvas = document.createElement("canvas");
      const tick = () => {
        if (stopped) return;
        frame = requestAnimationFrame(tick);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx || el.videoWidth === 0) return;
        canvas.width = Math.min(el.videoWidth, MAX_WIDTH);
        canvas.height = Math.round((el.videoHeight * canvas.width) / el.videoWidth);
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = decode(image.data, image.width, image.height);
        if (found?.data) {
          stop();
          callbacks.current.onCode(found.data);
        }
      };
      if (!stopped) tick();
    }

    void start();
    return stop;
  }, []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-lg bg-surface-sunken">
      <video ref={video} playsInline muted autoPlay aria-label={t("receipt.cameraLabel")} className="size-full object-cover" />
      <div aria-hidden className="pointer-events-none absolute inset-8 rounded-lg border-2 border-brand" />
    </div>
  );
}
