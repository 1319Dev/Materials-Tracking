import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AuthLayout, RequireAuth } from "@/components/layouts";
import { AuthCallbackPage } from "@/pages/auth-callback";
import { CheckInPage } from "@/pages/check-in";
import { DashboardPage } from "@/pages/dashboard";
import { HomeRedirect } from "@/pages/home-redirect";
import { InventoryDetailPage } from "@/pages/inventory-detail";
import { InventoryPage } from "@/pages/inventory";
import { LoginPage } from "@/pages/login";
import { MaterialDetailPage } from "@/pages/material-detail";
import { MtrRequestPage } from "@/pages/mtr-request";
import { PackingListPage } from "@/pages/packing-list";
import { NotFoundPage } from "@/pages/not-found";
import { SignupPage } from "@/pages/signup";

const ImportPage = lazy(() =>
  import("@/pages/import").then((module) => ({ default: module.ImportPage })),
);

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/import"
          element={
            <Suspense fallback={<p className="px-4 py-6 text-sm text-[var(--muted)]">Loading…</p>}>
              <ImportPage />
            </Suspense>
          }
        />
        <Route path="/check-in" element={<CheckInPage />} />
        <Route path="/packing-list" element={<PackingListPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/inventory/:id" element={<InventoryDetailPage />} />
        <Route path="/materials/:id" element={<MaterialDetailPage />} />
        <Route path="/mtr-request/:materialId" element={<MtrRequestPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
