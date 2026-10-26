import { NavLink, Outlet } from "react-router";

// Placeholders until #326 (AI usage), #330 and #331 (Flow) fill these pages in.
const LINKS = [
  { to: "/", label: "Overview", end: true },
  { to: "/ai", label: "AI usage", end: false },
  { to: "/flow", label: "Flow", end: false },
];

/** The signed-in shell: a left nav and the page. NavLink sets aria-current="page" on the current link. */
export function Layout() {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <nav aria-label="Main" className="border-b border-border md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <ul className="m-0 flex list-none gap-1 p-2 md:flex-col">
          {LINKS.map(({ to, label, end }) => (
            <li key={to} className="m-0">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-11 items-center rounded-control px-3 font-semibold ${
                    isActive ? "bg-accent text-accent-contrast" : "text-text"
                  }`
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
}
