import { Navigate, Route, Routes } from "react-router";
import { ChoresPageSkeleton, HomeSkeleton } from "../../domains/home/components/HomeSkeleton";
import { ResidentPageSkeleton } from "../../domains/residents/components/ResidentPageSkeleton";
import { BackToHome } from "../../domains/residents/components/BackToHome";
import { lazyWithReload } from "../lazyWithReload";
import { AuthLayout } from "./AuthLayout";
import { ConfirmPage, SignInPage, SignUpPage } from "./AuthPages";
import { Guard } from "./Guard";
import { LazyPage } from "./LazyPage";
import { MeEditFallback, MeFallback } from "./lazyFallbacks";
import { TodayPage } from "./pages";
import { CHORES_PATH, CONFIRM_PATH, HOME_PATH, ME_EDIT_PATH, ME_PATH, RESIDENT_PATH, SIGN_IN_PATH, SIGN_UP_PATH, TODAY_PATH, WELCOME_PREFIX } from "../logic/routes";
import { Shell } from "./Shell";
import { WelcomeLayout } from "./WelcomeLayout";

// Every screen but Today loads on demand. Declared at module level: a lazy() inside a component would be a new
// component type on every render and remount the screen.
const ChoresPage = lazyWithReload(() => import("./pages/ChoresPage"));
const HomePage = lazyWithReload(() => import("./pages/HomePage"));
const ResidentRoute = lazyWithReload(() => import("./pages/ResidentRoute"));
const MePage = lazyWithReload(() => import("./pages/MePage"));
const MeEdit = lazyWithReload(() => import("../../domains/profile/components/MeEdit").then((module) => ({ default: module.MeEdit })));

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
              <LazyPage
                key="resident"
                message="resident.loading"
                skeleton={
                  <>
                    <BackToHome />
                    <ResidentPageSkeleton />
                  </>
                }
              >
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
