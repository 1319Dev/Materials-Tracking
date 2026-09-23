import type { ReactNode } from "react";

export function PageShell({
  title,
  description,
  actions,
  children,
  wide = false,
  headerClassName = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  headerClassName?: string;
}) {
  return (
    <div className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${headerClassName}`}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
