import { Banner, Button, Card, Skeleton } from "@homeowner/bedrock";
import type { ReactNode } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";

/** What every read of this screen hands a Block. */
export interface BlockState<T> {
  data: T | undefined;
  /** The read failed and there is nothing to show. */
  failed: boolean;
  reload(): void;
}

/**
 * A card's read: a skeleton while it loads, its own alert with Retry when it fails, the card once the data is here.
 * A failure never reaches the cards that read something else.
 */
export function Block<T>({ label, failed, state, children }: { label: string; failed: string; state: BlockState<T>; children(data: T): ReactNode }) {
  const { t } = useI18n();
  if (state.data !== undefined) return <>{children(state.data)}</>;
  return (
    <Card aria-busy={!state.failed || undefined}>
      <h2 className="card-label text-text-muted">{label}</h2>
      {state.failed ? (
        <Banner tone="danger" action={<Button variant="ghost" size="sm" onClick={state.reload}>{t("overview.retry")}</Button>}>
          {failed}
        </Banner>
      ) : (
        <Skeleton className="h-24 w-full" />
      )}
    </Card>
  );
}
