import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "../components/button";

type Tone = "info" | "success" | "warning" | "danger";

// info has no colour token, so it uses text-muted; each tone still has its own icon.
const tones: Record<Tone, { icon: LucideIcon; color: string; role: "alert" | "status" }> = {
  info: { icon: Info, color: "text-text-muted", role: "status" },
  success: { icon: CircleCheck, color: "text-positive", role: "status" },
  warning: { icon: TriangleAlert, color: "text-warning", role: "status" },
  danger: { icon: CircleAlert, color: "text-danger", role: "alert" },
};

type AlertCardProps = {
  tone: Tone;
  /** Says what the alert is, so colour is never the only cue. */
  title: string;
  message: string;
  /** Rendered as a secondary sm Button, outside the live region. */
  action?: { label: string; onClick: () => void };
};

/**
 * Something that needs attention now. At most one per screen, below the hero card.
 *
 * Live region: `danger` is `role="alert"` (assertive), the other tones `role="status"`
 * (polite). A live region announces what is inserted after the page loads; a card
 * rendered with the page is read as normal content. So the app inserts the card when
 * the condition appears and removes it when it ends; it must not toggle the text of a
 * card that is already there. The role sits on the text, not around the action.
 */
export function AlertCard({ tone, title, message, action }: AlertCardProps) {
  const { icon: Icon, color, role } = tones[tone];
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 rounded-lg border border-border bg-surface p-4 text-text">
      <Icon className={`size-6 ${color}`} aria-hidden />
      <div role={role} className="flex flex-col gap-1">
        <p className="body-strong">{title}</p>
        <p className="caption text-text-muted">{message}</p>
      </div>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
