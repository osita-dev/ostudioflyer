// ─────────────────────────────────────────────────────────────────────────────
// AppShell — composition of the app chrome (step 06 / D1):
// mobile bottom nav (Home · History · Library · Settings), desktop left rail.
// Generate/Edit are stack screens — nav hides so the task owns the screen.
// ─────────────────────────────────────────────────────────────────────────────

import { NavLink, Outlet, useLocation } from "react-router-dom";
import { History as HistoryIcon, Home, Library, Settings } from "lucide-react";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/history", label: "History", icon: HistoryIcon, end: false },
  { to: "/library", label: "Library", icon: Library, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
] as const;

function navClass(isActive: boolean): string {
  return [
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
    isActive
      ? "bg-gold/15 text-gold font-medium"
      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
  ].join(" ");
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xl leading-none text-gold">◉</span>
      <span>
        <span className="block text-sm font-semibold tracking-wide text-foreground">
          O Studio Daily
        </span>
        <span className="block text-[11px] text-muted-foreground">Content Studio</span>
      </span>
    </div>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const isStack = pathname === "/generate" || pathname === "/edit";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* desktop rail */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-56 flex-col border-r border-border bg-card/60 p-4 md:flex">
        <div className="px-2 py-3">
          <Brand />
        </div>
        <nav className="mt-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => navClass(isActive)}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-2 text-[11px] leading-relaxed text-muted-foreground">
          Generate only when you mean to.
          <br />
          Downloads are final picks.
        </p>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <Brand />
        <NavLink to="/history" className="text-muted-foreground" aria-label="History">
          <HistoryIcon className="h-5 w-5" />
        </NavLink>
      </header>

      <main className="pb-24 md:pb-10 md:pl-56">
        <Outlet />
      </main>

      {/* mobile bottom nav */}
      {!isStack && (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card/95 px-2 py-1.5 backdrop-blur md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[11px]",
                  isActive ? "text-gold" : "text-muted-foreground",
                ].join(" ")
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
