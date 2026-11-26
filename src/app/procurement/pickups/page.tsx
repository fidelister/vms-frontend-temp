"use client";

import { useState } from "react";
import { PageTitle, PageCard } from "@/components/dashboard/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { contractorsApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { useApi } from "@/lib/api/useApi";
import { formatDate } from "@/lib/utils";
import type { Contractor } from "@/lib/types";

/**
 * All 12 documents approved ≠ active — the contractor still has to
 * physically show up and collect their printed ID card. Confirming that
 * here is the one action that actually flips them to `active`. See
 * FRONTEND_INTEGRATION_GUIDE.md §4.4 Step 4.
 */
export default function ProcurementPickupsPage() {
  const { data, loading, error, setData } = useApi<Contractor[]>(() => contractorsApi.awaitingPickup(), []);
  const rows = data ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function confirm(contractor: Contractor) {
    if (!window.confirm(`Confirm ${contractor.name ?? contractor.email} has collected their ID card?`)) return;
    setBusyId(contractor._id);
    setActionError(null);
    try {
      await contractorsApi.confirmPickup(contractor._id);
      setData((prev) => (prev ?? []).filter((c) => c._id !== contractor._id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.messages.join(" ") : "Could not confirm this pickup.");
    } finally {
      setBusyId(null);
    }
  }

  const columns: Column<Contractor>[] = [
    { key: "name", header: "Name", render: (c) => c.name ?? "—" },
    { key: "companyName", header: "Company", render: (c) => c.companyName ?? "—" },
    { key: "idNumber", header: "ID number", render: (c) => c.idNumber ?? "—" },
    { key: "email", header: "Email address", render: (c) => c.email },
    { key: "validityTo", header: "Expiring date", render: (c) => formatDate(c.validityTo) },
    {
      key: "action",
      header: "",
      width: "160px",
      render: (c) => (
        <button
          onClick={() => confirm(c)}
          disabled={busyId !== null}
          className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
        >
          {busyId === c._id ? "Confirming…" : "Confirm pickup"}
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageTitle>Awaiting ID Pickup</PageTitle>

      <PageCard className="px-7 py-7">
        <h2 className="mb-6 text-2xl font-bold text-ink">Contractors ready to collect their ID card</h2>
        {actionError && (
          <p role="alert" className="mb-4 rounded-[4px] bg-red-light px-4 py-3 text-sm text-red">
            {actionError}
          </p>
        )}
        {loading ? (
          <p className="py-16 text-center text-sm text-muted">Loading&hellip;</p>
        ) : error ? (
          <p className="py-16 text-center text-sm text-red">{error}</p>
        ) : (
          <DataTable columns={columns} rows={rows} emptyLabel="No one is waiting on an ID card right now" />
        )}
      </PageCard>
    </div>
  );
}
