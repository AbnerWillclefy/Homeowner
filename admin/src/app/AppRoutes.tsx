import { Route, Routes } from "react-router";
import { Layout } from "./Layout";
import { PAGES } from "./pages";
import { Placeholder } from "./Placeholder";

/** The signed-in pages, inside the nav layout. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {PAGES.map(({ path, element }) =>
          path === "" ? <Route key="index" index element={element} /> : <Route key={path} path={path} element={element} />,
        )}
        <Route path="*" element={<Placeholder title="Page not found" note="Use the menu to go back." />} />
      </Route>
    </Routes>
  );
}
