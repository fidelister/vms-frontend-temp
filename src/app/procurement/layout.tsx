"use client";

import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { NAV_ITEMS } from "@/lib/nav-config";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/AuthProvider";
import { InstitutionBrandProvider } from "@/lib/institution/InstitutionBrandContext";
import { institutionsApi } from "@/lib/api/endpoints";
import { useApi } from "@/lib/api/useApi";

/**
 * Procurement Admin is scoped narrowly to contractor review only — no
 * visitor/officer/dispatch access, but it still needs its own institution's
 * name/logo for the sidebar crest and the contractor permit template, same
 * as Security Officer and Host.
 */
export default function ProcurementLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="procurement_admin">
      <ProcurementShell>{children}</ProcurementShell>
    </RequireRole>
  );
}

function ProcurementShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: brand } = useApi(() => institutionsApi.myBrand(), []);

  return (
    <InstitutionBrandProvider value={brand ?? null}>
      <DashboardShell
        navItems={NAV_ITEMS.procurement_admin}
        userName={user?.name ?? ""}
        userPhotoUrl={user?.photoUrl}
        showVisitorShortcuts={false}
      >
        {children}
      </DashboardShell>
    </InstitutionBrandProvider>
  );
}
