import { NavLink, Outlet, useLocation } from "react-router";
import { PAGES } from "./pages";

/**
 * The signed-in shell: a left rail and the page. NavLink sets aria-current="page"; the current link is bold with an
 * accent bar, so colour is not the only cue.
 */
export function Layout() {
  // The nav keeps the query string, so the chosen range follows you from page to page.
  const { search } = useLocation();
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <nav aria-label="Main" className="border-b border-border/50 bg-surface-raised md:w-52 md:shrink-0 md:border-r md:border-b-0">
        <ul className="m-0 flex list-none gap-1 p-2 md:sticky md:top-14 md:flex-col">
          {PAGES.map(({ path, label, icon }) => (
            <li key={path} className="m-0">
              <NavLink
                to={{ pathname: `/${path}`, search }}
                end={path === ""}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-control border-l-[3px] px-3 text-sm motion-safe:transition-colors motion-safe:duration-150 ${
                    isActive ? "border-accent bg-surface font-semibold text-text" : "border-transparent text-muted hover:bg-surface hover:text-text"
                  }`
                }
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round">
                  {icon}
                </svg>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
