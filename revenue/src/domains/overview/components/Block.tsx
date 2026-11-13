import { Banner, Button, Skeleton } from "@homeowner/bedrock";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";

/**
 * A block's read: a skeleton while it loads, its own alert with Retry when it fails, the content once it is here.
 * A failure never reaches the blocks that read something else.
 */
export function Block<T>({ heading, failed, query, children }: { heading?: string; failed: string; query: UseQueryResult<T>; children(data: T): ReactNode }) {
  const { t } = useI18n();
  if (query.isError) {
    return (
      <section className="flex flex-col gap-3">
        {heading && <h2 className="section-title">{heading}</h2>}
        <Banner tone="danger" action={<Button variant="ghost" size="sm" onClick={() => void query.refetch()}>{t("overview.retry")}</Button>}>
          {failed}
        </Banner>
      </section>
    );
  }
  if (query.data === undefined) {
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        {heading && <h2 className="section-title">{heading}</h2>}
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }
  return <>{children(query.data)}</>;
}
