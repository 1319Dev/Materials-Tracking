import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/import", label: "Import" },
  { href: "/check-in", label: "Check in" },
  { href: "/inventory", label: "Inventory" },
];

export async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="font-semibold tracking-tight text-[var(--ink)]">
            Materials Tracking
          </Link>
          {user?.email ? (
            <p className="truncate text-xs text-[var(--muted)] sm:hidden">{user.email}</p>
          ) : null}
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)]"
            >
              {item.label}
            </Link>
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
