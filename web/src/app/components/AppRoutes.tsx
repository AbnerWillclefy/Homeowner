import { Navigate, Route, Routes } from "react-router";
import { ChoresPageSkeleton, HomeSkeleton } from "../../domains/home/components/HomeSkeleton";
import { lazyNamed } from "../lazyWithReload";
import { AuthLayout } from "./AuthLayout";
import { ConfirmPage, SignInPage, SignUpPage } from "./AuthPages";
import { Guard } from "./Guard";
import { LazyPage } from "./LazyPage";
import { FinancesFallback, MeEditFallback, MeFallback, ResidentFallback } from "./lazyFallbacks";
import { FinanceRoute } from "./pages/FinanceRoute";
import { TodayPage } from "./pages";
import { CHORES_PATH, CONFIRM_PATH, FINANCES_BILLS_PATH, FINANCES_PATH, FINANCES_SAVINGS_PATH, FINANCES_SETTINGS_PATH, FINANCES_SPENDING_PATH, HOME_PATH, ME_EDIT_PATH, ME_PATH, RESIDENT_PATH, SIGN_IN_PATH, SIGN_UP_PATH, TODAY_PATH, WELCOME_PREFIX } from "../logic/routes";
import { Shell } from "./Shell";
import { WelcomeLayout } from "./WelcomeLayout";

// Every screen but Today loads on demand. Declared at module level: a lazy() inside a component would be a new
// component type on every render and remount the screen.
const ChoresPage = lazyNamed(() => import("./pages/ChoresPage"), "ChoresPage");
const HomePage = lazyNamed(() => import("./pages/HomePage"), "HomePage");
const ResidentRoute = lazyNamed(() => import("./pages/ResidentRoute"), "ResidentRoute");
const MePage = lazyNamed(() => import("./pages/MePage"), "MePage");
const FinancesTab = lazyNamed(() => import("../../domains/finance/components/FinancesTab"), "FinancesTab");
const FinanceSettings = lazyNamed(() => import("../../domains/finance/components/FinanceSettings"), "FinanceSettings");
const FinanceSavings = lazyNamed(() => import("../../domains/finance/components/FinanceSavings"), "FinanceSavings");
const MeEdit =lazyNamed(() => import("../../domains/profile/components/MeEdit"), "MeEdit");

/**
 * Every route sits under the Guard, which decides where the person may be (see resolveRoute). The catch-all
 * renders nothing: the guard redirects any unknown path before it is reached, so there is never a blank screen.
 *
 * Each lazy screen has its own LazyPage with its own key (see LazyPage for why), whose fallback is that page's
 * skeleton.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Guard />}>
        <Route element={<AuthLayout />}>
          <Route path={SIGN_IN_PATH} element={<SignInPage />} />
          <Route path={SIGN_UP_PATH} element={<SignUpPage />} />
          <Route path={CONFIRM_PATH} element={<ConfirmPage />} />
        </Route>
        <Route path={`${WELCOME_PREFIX}/*`} element={<WelcomeLayout />} />
        <Route element={<Shell />}>
          <Route path={TODAY_PATH} element={<TodayPage />} />
          <Route
            path={CHORES_PATH}
            element={
              <LazyPage key="chores" message="chores.loading" skeleton={<ChoresPageSkeleton />}>
                <ChoresPage />
              </LazyPage>
            }
          />
          <Route
            path={HOME_PATH}
            element={
              <LazyPage key="home" message="home.loading" skeleton={<HomeSkeleton />}>
                <HomePage />
              </LazyPage>
            }
          />
          <Route
            path={RESIDENT_PATH}
            element={
              <LazyPage key="resident" message="resident.loading" skeleton={<ResidentFallback />}>
                <ResidentRoute />
              </LazyPage>
            }
          />
          <Route
            path={ME_PATH}
            element={
              <LazyPage key="me" message="profile.loading" skeleton={<MeFallback />}>
                <MePage />
              </LazyPage>
            }
          />
          {([[FINANCES_PATH, "summary"], [FINANCES_SPENDING_PATH, "spending"], [FINANCES_BILLS_PATH, "bills"]] as const).map(([path, view]) => (
            <Route
              key={path}
              path={path}
              element={
                <FinanceRoute>
                  <LazyPage key="finances" message="finances.loading" skeleton={<FinancesFallback />}>
                    <FinancesTab view={view} />
                  </LazyPage>
                </FinanceRoute>
              }
            />
          ))}
          <Route
            path={FINANCES_SETTINGS_PATH}
            element={
              <FinanceRoute>
                <LazyPage key="finances-settings" message="finances.loading" skeleton={<FinancesFallback />}>
                  <FinanceSettings />
                </LazyPage>
              </FinanceRoute>
            }
          />
          <Route
            path={FINANCES_SAVINGS_PATH}
            element={
              <FinanceRoute>
                <LazyPage key="finances-savings" message="finances.loading" skeleton={<FinancesFallback />}>
                  <FinanceSavings />
                </LazyPage>
              </FinanceRoute>
            }
          />
          <Route
            path={ME_EDIT_PATH}
            element={
              <LazyPage key="me-edit" message="profile.loading" skeleton={<MeEditFallback />}>
                <MeEdit />
              </LazyPage>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to={TODAY_PATH} replace />} />
      </Route>
    </Routes>
  );
}
