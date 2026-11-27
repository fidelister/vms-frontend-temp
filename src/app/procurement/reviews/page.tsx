"use client";

import { useEffect, useState } from "react";
import { PageTitle, PageCard } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { contractorsApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { useApi } from "@/lib/api/useApi";
import { formatDate } from "@/lib/utils";
import type { Contractor, ContractorDocumentField } from "@/lib/types";

/** Every contractor document field, in submission order — see §4.4 Step 2/3. */
const DOCUMENT_FIELDS: Array<[ContractorDocumentField, string]> = [
  ["companyProfileDoc", "Company profile"],
  ["cacCertificate", "CAC certificate"],
  ["taxClearanceCertificate", "Tax clearance certificate"],
  ["vatCertificate", "VAT certificate"],
  ["pencomCertificate", "Pencom certificate"],
  ["itfCertificate", "ITF certificate"],
  ["nsitfCertificate", "NSITF certificate"],
  ["bppRegistrationCertificate", "BPP registration certificate"],
  ["efccScumlCertificate", "EFCC/SCUML certificate"],
  ["passportPhotos", "Passport photos"],
  ["ninDocument", "NIN document"],
  ["letterOfIntroduction", "Letter of introduction"],
];

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-[5px] text-[13px]">
      <span className="w-[160px] shrink-0 text-muted">{label}:</span>
      <span className="flex-1 text-ink">{value}</span>
    </div>
  );
}

const REVIEW_STAGE_LABEL: Record<string, string> = {
  awaiting_review: "Awaiting review",
  awaiting_resubmission: "Awaiting resubmission",
};

function documentLinks(contractor: Contractor, field: ContractorDocumentField) {
  if (field === "passportPhotos") {
    return (contractor.passportPhotos ?? []).map((url, i) => ({ url, label: `Photo ${i + 1}` }));
  }
  const url = contractor[field];
  return typeof url === "string" && url ? [{ url, label: "View" }] : [];
}

export default function ProcurementReviewsPage() {
  const { data, loading, error, setData } = useApi<Contractor[]>(() => contractorsApi.pendingReview(), []);
  const rows = data ?? [];
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Contractor | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [busyField, setBusyField] = useState<ContractorDocumentField | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!reviewingId) return;
    let cancelled = false;
    contractorsApi
      .get(reviewingId)
      .then((c) => {
        if (!cancelled) setDetail(c);
      })
      .catch((err) => {
        if (!cancelled) {
          setDetailError(err instanceof ApiError ? err.messages.join(" ") : "Could not load this submission.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reviewingId]);

  async function reviewDocument(field: ContractorDocumentField, approved: boolean) {
    if (!detail) return;
    let reason: string | undefined;
    if (!approved) {
      const entered = window.prompt(
        "Why is this document being rejected? Only this document is affected — the contractor keeps everything else and just replaces this one file.",
      );
      if (!entered) return;
      reason = entered;
    }
    setBusyField(field);
    setActionError(null);
    try {
      const updated = await contractorsApi.reviewDocument(detail._id, field, { approved, reason });
      setDetail(updated);
      if (updated.status !== "pending_review") {
        // Every document just got approved — auto-moved to awaiting_id_pickup,
        // so it drops off this list. A single rejected document no longer
        // does this; the contractor stays pending_review and the row just
        // gets patched below instead.
        setData((prev) => (prev ?? []).filter((c) => c._id !== updated._id));
        setReviewingId(null);
      } else {
        setData((prev) => (prev ?? []).map((c) => (c._id === updated._id ? updated : c)));
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.messages.join(" ") : "Could not record that review.");
    } finally {
      setBusyField(null);
    }
  }

  const columns: Column<Contractor>[] = [
    { key: "name", header: "Name", render: (c) => c.name ?? "—" },
    { key: "companyName", header: "Company", render: (c) => c.companyName ?? "—" },
    { key: "email", header: "Email address", width: "1.3fr", render: (c) => c.email },
    { key: "rcNumber", header: "RC number", render: (c) => c.rcNumber ?? "—" },
    { key: "validityTo", header: "Expiring date", render: (c) => formatDate(c.validityTo) },
    {
      key: "reviewStage",
      header: "Status",
      render: (c) => (
        <span
          className={
            c.reviewStage === "awaiting_resubmission"
              ? "rounded-[4px] bg-red-light px-2 py-1 text-xs font-semibold text-red"
              : "rounded-[4px] bg-primary-light px-2 py-1 text-xs font-semibold text-primary"
          }
        >
          {(c.reviewStage && REVIEW_STAGE_LABEL[c.reviewStage]) ?? "Awaiting review"}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      width: "120px",
      render: (c) => (
        <button
          onClick={() => {
            setDetail(null);
            setDetailError(null);
            setReviewingId(c._id);
          }}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Review
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageTitle>Pending Reviews</PageTitle>

      <PageCard className="px-7 py-7">
        <h2 className="mb-6 text-2xl font-bold text-ink">Contractor submissions awaiting review</h2>
        {loading ? (
          <p className="py-16 text-center text-sm text-muted">Loading submissions&hellip;</p>
        ) : error ? (
          <p className="py-16 text-center text-sm text-red">{error}</p>
        ) : (
          <DataTable columns={columns} rows={rows} emptyLabel="Nothing awaiting review right now" />
        )}
      </PageCard>

      <Modal
        open={!!reviewingId}
        onClose={() => {
          setReviewingId(null);
          setDetail(null);
        }}
        title="Contractor submission"
        className="w-[680px]"
      >
        {detailError ? (
          <p role="alert" className="m-7 rounded-[4px] bg-red-light px-4 py-3 text-sm text-red">
            {detailError}
          </p>
        ) : !detail ? (
          <p className="py-16 text-center text-sm text-muted">Loading&hellip;</p>
        ) : (
          <div className="px-7 py-6">
            <Row label="Name" value={detail.name} />
            <Row label="Company name" value={detail.companyName} />
            <Row label="Email" value={detail.email} />
            <Row label="Phone" value={detail.phone} />
            <Row label="Nationality" value={detail.nationality} />
            <Row label="Address" value={detail.addressOfContractor} />
            <Row label="Permanent address" value={detail.permanentAddress} />
            <Row label="Office address" value={detail.officeAddress} />
            <Row label="RC number" value={detail.rcNumber} />
            <Row label="TIN" value={detail.tin} />
            <Row
              label="BPP registration date"
              value={detail.bppRegistrationDate ? formatDate(detail.bppRegistrationDate) : undefined}
            />
            <Row
              label="Validity period"
              value={`${formatDate(detail.validityFrom)} – ${formatDate(detail.validityTo)}`}
            />

            <p className="mb-2 mt-5 text-sm font-semibold text-ink">
              Documents — approve or reject each one individually. Rejecting one only flags that document; the
              contractor replaces just that file on the same link and everything else stays locked in.
            </p>
            <div className="flex flex-col gap-2">
              {DOCUMENT_FIELDS.map(([field, label]) => {
                const links = documentLinks(detail, field);
                const review = detail.documentReviews?.[field];
                const approved = review?.status === "approved";
                const rejected = review?.status === "rejected";
                return (
                  <div
                    key={field}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{label}</p>
                      <div className="flex flex-wrap gap-3">
                        {links.length === 0 ? (
                          <span className="text-xs text-muted">Not provided</span>
                        ) : (
                          links.map((l) => (
                            <a
                              key={l.url}
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              {l.label}
                            </a>
                          ))
                        )}
                      </div>
                      {rejected && review?.reason && (
                        <p className="mt-1 text-xs text-red">Rejected: {review.reason} — awaiting replacement.</p>
                      )}
                    </div>
                    {approved ? (
                      <span className="shrink-0 rounded-[4px] bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">
                        Approved
                      </span>
                    ) : (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          disabled={busyField !== null}
                          onClick={() => reviewDocument(field, true)}
                        >
                          {busyField === field ? "…" : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyField !== null}
                          onClick={() => reviewDocument(field, false)}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {actionError && (
              <p role="alert" className="mt-5 rounded-[4px] bg-red-light px-4 py-3 text-sm text-red">
                {actionError}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
