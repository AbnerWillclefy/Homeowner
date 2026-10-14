import { Navigate, Route, Routes } from "react-router";
import { AuthLayout } from "./AuthLayout";
import { ConfirmPage, SignInPage, SignUpPage } from "./AuthPages";
import { Guard } from "./Guard";
import { ChoresPage, HomePage, MePage, TodayPage } from "./pages";
import { CHORES_PATH, CONFIRM_PATH, HOME_PATH, ME_PATH, SIGN_IN_PATH, SIGN_UP_PATH, TODAY_PATH, WELCOME_PREFIX } from "../logic/routes";
import { Shell } from "./Shell";
import { WelcomeLayout } from "./WelcomeLayout";

/**
 * Every route sits under the Guard, which decides where the person may be (see resolveRoute). The catch-all
 * renders nothing: the guard redirects any unknown path before it is reached, so there is never a blank screen.
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
          <Route path={CHORES_PATH} element={<ChoresPage />} />
          <Route path={HOME_PATH} element={<HomePage />} />
          <Route path={ME_PATH} element={<MePage />} />
        </Route>
        <Route path="*" element={<Navigate to={TODAY_PATH} replace />} />
      </Route>
    </Routes>
  );
}
