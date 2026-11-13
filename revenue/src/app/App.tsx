import { Route, Routes } from "react-router";
import { useState } from "react";
import { ScreenPlaceholder } from "../shared/ScreenPlaceholder";
import { ForgotPassword } from "../auth/ForgotPassword";
import { SignIn } from "../auth/SignIn";
import { useAuth } from "../auth/AuthContext";
import { Gate } from "./Gate";
import { ROUTES } from "./screens";
import { Shell } from "./Shell";

/** Signed out: sign-in or forgot password. Signed in: the Gate, then the shell with the screens. */
export function App() {
  const { signedIn } = useAuth();
  const [forgot, setForgot] = useState(false);
  if (!signedIn) return forgot ? <ForgotPassword onBack={() => setForgot(false)} /> : <SignIn onForgot={() => setForgot(true)} />;
  return (
    <Gate>
      <Routes>
        <Route element={<Shell />}>
          {ROUTES.map(({ path, element }) => (path === "/" ? <Route key={path} index element={element} /> : <Route key={path} path={path} element={element} />))}
          <Route path="*" element={<ScreenPlaceholder titleKey="page.notFound" />} />
        </Route>
      </Routes>
    </Gate>
  );
}
