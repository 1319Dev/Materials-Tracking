import { NavLink } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/import", label: "Import" },
  { to: "/check-in", label: "Check in" },
  { to: "/inventory", label: "Inventory" },
];

export function AppHeader() {
  const { user } = useAuth();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-4">
          <NavLink to="/dashboard" className="font-semibold tracking-tight text-[var(--ink)]">
            Materials Tracking
          </NavLink>
          {user?.email ? (
            <p className="truncate text-xs text-[var(--muted)] sm:hidden">{user.email}</p>
          ) : null}
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium hover:bg-[var(--surface-2)] ${
                  isActive ? "bg-[var(--surface-2)] text-[var(--accent)]" : "text-[var(--ink)]"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-2 sm:ml-3">
            {user?.email ? (
              <span className="hidden max-w-[12rem] truncate text-xs text-[var(--muted)] sm:inline">
                {user.email}
              </span>
            ) : null}
            <SignOutButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
