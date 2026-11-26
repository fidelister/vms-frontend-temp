import { PageTitle, PageCard } from "@/components/dashboard/PageHeader";
import { ContractorListTab } from "@/components/pages/ContractorsView";

/** Procurement Admin can suspend/blacklist a contractor — `revoke` is now shared with Institution Admin. */
export default function ProcurementContractorsPage() {
  return (
    <div>
      <PageTitle>Contractors</PageTitle>
      <PageCard className="px-7 py-7">
        <h2 className="mb-6 text-2xl font-bold text-ink">All contractors</h2>
        <ContractorListTab canManage />
      </PageCard>
    </div>
  );
}
