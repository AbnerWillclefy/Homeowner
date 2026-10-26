import type { RefObject } from "react";
import type { useCheckIn } from "../hooks/useCheckIn";
import { CheckInDialog } from "./CheckInDialog";

interface Props {
  checkIn: ReturnType<typeof useCheckIn>;
  open: boolean;
  onClose(): void;
  returnFocusRef: RefObject<HTMLElement | null>;
}

/**
 * The Shell's one Check-in dialog, shown while it is open and the Check-in is ready. Mounted only then, so the form
 * starts again from the saved Check-in each time.
 */
export function ShellCheckInDialog({ checkIn, open, onClose, returnFocusRef }: Props) {
  if (!open || checkIn.state.kind !== "ready") return null;
  return (
    <CheckInDialog
      checkIn={checkIn.state.checkIn}
      demands={checkIn.demands}
      save={checkIn.save}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    />
  );
}
