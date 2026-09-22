import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-3 px-4 py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-sm font-medium text-[var(--accent)]">
        Go home
      </Link>
    </div>
  );
}
