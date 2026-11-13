import { Card } from "@homeowner/bedrock";
import type { ReactNode } from "react";
import { useI18n } from "./i18n/I18nProvider";
import { Preferences } from "./Preferences";

/** The frame of every screen before the shell: sign-in, forgot password, no access, a gate error. */
export function CenteredCard({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-4">
      <main id="main" tabIndex={-1} className="flex flex-col gap-6 outline-none">
        <Card className="gap-4">
          <p className="label text-brand">{t("app.name")}</p>
          <h1 className="page-title">{title}</h1>
          {children}
        </Card>
        <Preferences />
      </main>
    </div>
  );
}
