import { List } from "@homeowner/bedrock";
import { Ban, Heart, Zap } from "lucide-react";
import { useI18n } from "../../../shared/i18n";
import { HeadedSection } from "../../../shared/ui/HeadedSection";
import { IconTile } from "../../../shared/ui/IconTile";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SheetRow } from "../../../shared/ui/SheetRow";
import { useProfile } from "../hooks/useProfile";
import { demandLabel, labelText } from "../logic/labels";
import { BaselineFields, PreferenceFields, ProfileStatus, RestrictionFields } from "./ProfileSections";
import { ProfileSkeleton } from "./ProfileSkeleton";

const TILE = "bg-surface-sunken text-text-muted";

/**
 * The first part of Me, "how the plan knows you": the Baseline, Preferences and Restrictions as rows, each opening a
 * Sheet with the same fields onboarding shows one step at a time. Each control saves on its own as soon as it
 * changes, and its toast offers Desfazer, which writes the old value of that control back.
 *
 * While the details load, only the skeleton shows; when they fail, only the alert and Retry. Never empty rows. It is
 * a section of its own: the rows MePage places after it never wait on it.
 */
export function MeProfile() {
  const { t } = useI18n();
  const { state, refreshing, retry, setBaseline, setPreference, setRestricted } = useProfile();

  // The page's one status announces the wait; the skeleton shows after 300ms. Only the first load and a Retry load.
  const showSkeleton = useReportFirstLoad(state.kind === "loading");
  // A read behind a profile already on screen shows the quiet indicator in the header, never a skeleton.
  useReportFetching(refreshing);

  return (
    <HeadedSection title={t("me.group.plan")}>
      {showSkeleton && <ProfileSkeleton />}
      {/* Load problems only; each save or undo is a toast, announced once by the toast region. */}
      <ProfileStatus state={state} retry={retry} />

      {state.kind === "ready" && (
        <List>
          <SheetRow
            icon={<IconTile icon={Zap} className={TILE} />}
            title={t("profile.baseline.heading")}
            subtitle={t("profile.baseline.hint")}
          >
            <BaselineFields baseline={state.profile.baseline} onSave={setBaseline} />
          </SheetRow>
          <SheetRow
            icon={<IconTile icon={Heart} className={TILE} />}
            title={t("profile.preferences.heading")}
            subtitle={t("profile.preferences.hint")}
          >
            <PreferenceFields profile={state.profile} categories={state.categories} onChange={setPreference} />
          </SheetRow>
          <SheetRow
            icon={<IconTile icon={Ban} className={TILE} />}
            title={t("profile.restrictions.heading")}
            caption={
              state.profile.restrictions.length === 0
                ? t("me.restrictions.none")
                : state.profile.restrictions.length === 1
                  ? labelText(t, demandLabel(state.profile.restrictions[0]))
                  : t("me.restrictions.count", { count: state.profile.restrictions.length })
            }
            subtitle={t("profile.restrictions.hint")}
          >
            <RestrictionFields restrictions={state.profile.restrictions} demands={state.demands} onChange={setRestricted} />
          </SheetRow>
        </List>
      )}
    </HeadedSection>
  );
}
