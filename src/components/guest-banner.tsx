import { Link } from "react-router-dom";

export function GuestBanner() {
  return (
    <div className="border-b border-[var(--border)] bg-[var(--accent-soft)] px-4 py-2 text-center text-sm text-[var(--ink)]">
      Browsing sample data on this device.{" "}
      <Link to="/login" className="font-semibold text-[var(--accent)] underline">
        Sign in
      </Link>{" "}
      to save to the cloud.
    </div>
  );
}
