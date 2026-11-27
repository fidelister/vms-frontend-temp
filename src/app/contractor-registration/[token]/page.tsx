"use client";

import { use, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { contractorRegistrationApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type { ContractorDocumentField, ContractorRegistrationView } from "@/lib/types";

const inputClass =
  "h-11 w-full rounded-[4px] border border-border bg-white px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-border focus:border-primary";

/** [field name, label, accept] — every document the submit endpoint requires except passportPhotos (handled separately, needs exactly 2). */
const DOCUMENT_FIELDS: Array<[string, string]> = [
  ["companyProfileDoc", "Company profile"],
  ["cacCertificate", "CAC certificate"],
  ["taxClearanceCertificate", "Tax clearance certificate"],
  ["vatCertificate", "VAT certificate"],
  ["pencomCertificate", "Pencom certificate"],
  ["itfCertificate", "ITF certificate"],
  ["nsitfCertificate", "NSITF certificate"],
  ["bppRegistrationCertificate", "BPP registration certificate"],
  ["efccScumlCertificate", "EFCC/SCUML certificate"],
  ["ninDocument", "NIN document"],
  ["letterOfIntroduction", "Letter of introduction"],
];

const DOCUMENT_FIELD_LABEL: Record<string, string> = Object.fromEntries([
  ...DOCUMENT_FIELDS,
  ["passportPhotos", "Passport photos"],
]);

export default function ContractorRegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [view, setView] = useState<ContractorRegistrationView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    contractorRegistrationApi
      .view(token)
      .then((v) => {
        if (!cancelled) setView(v);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError && err.statusCode === 404
            ? "This registration link isn't valid. Check the link in your email and try again."
            : "Couldn't load this registration. Please try again shortly.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const institutionName = view?.institution.name ?? "Institution";

  return (
    <div className="flex min-h-screen flex-col items-center bg-grey px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        {view?.institution.logoUrl && (
          <Image src={view.institution.logoUrl} alt="" width={64} height={64} />
        )}
        <h1 className="font-display text-[22px] uppercase leading-tight text-primary">{institutionName}</h1>
        <p className="text-sm text-muted">Contractor registration</p>
      </div>

      <div className="w-full max-w-[640px] rounded-[10px] bg-white p-8 shadow-sm">
        {loadError ? (
          <p role="alert" className="rounded-[4px] bg-red-light px-4 py-3 text-center text-sm text-red">
            {loadError}
          </p>
        ) : !view ? (
          <p className="py-10 text-center text-sm text-muted">Loading&hellip;</p>
        ) : submitted ? (
          <SubmittedPanel />
        ) : view.status === "active" ? (
          <StatusPanel heading="Already approved" body="Your contractor registration has already been approved. No further action is needed." />
        ) : view.status === "awaiting_id_pickup" ? (
          <StatusPanel
            heading="Approved — come collect your ID card"
            body="All your documents have been approved. Please visit the institution to collect your printed ID card."
          />
        ) : view.status === "pending_review" ? (
          <RejectedDocumentsPanel
            token={token}
            view={view}
            onReplaced={(next) => setView(next)}
          />
        ) : view.paymentStatus !== "paid" ? (
          <PaymentPanel
            token={token}
            fee={view.registrationFee}
            onPaid={() => setView({ ...view, paymentStatus: "paid" })}
          />
        ) : (
          <RegistrationForm token={token} view={view} onSubmitted={() => setSubmitted(true)} />
        )}
      </div>
    </div>
  );
}

function StatusPanel({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="py-6 text-center">
      <h2 className="text-lg font-bold text-ink">{heading}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}

function SubmittedPanel() {
  return (
    <StatusPanel
      heading="Registration submitted"
      body="Thanks — your details and documents have been sent for review. You'll hear back by email once a decision is made."
    />
  );
}

/**
 * `pending_review` no longer has a whole-application "rejected" state —
 * rejection is scoped to individual documents. If any of the 12 are
 * currently flagged, show just a replace-this-one-file control for each of
 * them; everything else the contractor submitted stays locked and untouched.
 */
function RejectedDocumentsPanel({
  token,
  view,
  onReplaced,
}: {
  token: string;
  view: ContractorRegistrationView;
  onReplaced: (next: ContractorRegistrationView) => void;
}) {
  const flaggedDocs = Object.entries(view.documentReviews ?? {}).filter(
    ([, review]) => review.status === "rejected",
  );

  if (flaggedDocs.length === 0) {
    return (
      <StatusPanel
        heading="Submission received"
        body="Your documents are with the institution's procurement team for review. You'll be notified by email once a decision is made."
      />
    );
  }

  function refresh() {
    contractorRegistrationApi
      .view(token)
      .then(onReplaced)
      .catch(() => {
        /* the just-replaced document still uploaded fine — a refresh hiccup isn't fatal here */
      });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[4px] bg-red-light px-4 py-3 text-sm text-red">
        <p className="font-semibold">One or more documents need to be replaced:</p>
        <ul className="mt-1 list-disc pl-5">
          {flaggedDocs.map(([field, review]) => (
            <li key={field}>
              {DOCUMENT_FIELD_LABEL[field] ?? field}
              {review.reason ? `: ${review.reason}` : ""}
            </li>
          ))}
        </ul>
        <p className="mt-1">Everything else you already submitted stays as-is.</p>
      </div>
      {flaggedDocs.map(([field]) => (
        <DocumentResubmitForm
          key={field}
          token={token}
          field={field as ContractorDocumentField}
          onReplaced={refresh}
        />
      ))}
    </div>
  );
}

function DocumentResubmitForm({
  token,
  field,
  onReplaced,
}: {
  token: string;
  field: ContractorDocumentField;
  onReplaced: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsTwo = field === "passportPhotos";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const files = (new FormData(e.currentTarget).getAll("file") as File[]).filter((f) => f.size > 0);
    if (files.length === 0 || (needsTwo && files.length < 2)) {
      setError(needsTwo ? "Please choose both photos." : "Please choose a file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await contractorRegistrationApi.resubmitDocument(token, field, files);
      onReplaced();
    } catch (err) {
      setError(err instanceof ApiError ? err.messages.join(" ") : "Could not upload the replacement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-[4px] border border-border px-4 py-3">
      <label className="text-sm font-semibold text-ink">{DOCUMENT_FIELD_LABEL[field] ?? field}</label>
      <input name="file" type="file" accept={needsTwo ? "image/*" : "image/*,.pdf"} className={inputClass} required />
      {needsTwo && <input name="file" type="file" accept="image/*" className={inputClass} required />}
      {error && (
        <p role="alert" className="text-xs text-red">
          {error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={busy} className="self-start">
        {busy ? "Uploading…" : "Replace document"}
      </Button>
    </form>
  );
}

function PaymentPanel({ token, fee, onPaid }: { token: string; fee: number; onPaid: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Mock gateway (current default) returns paymentStatus "paid" immediately.
  // Once the real TAP gateway is wired up, this flips to "pending" with popup
  // params — poll payment/status until it flips to "paid" rather than trusting
  // anything pushed back from a client-side popup.
  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await contractorRegistrationApi.initiatePayment(token);
      if (res.paymentStatus === "paid") {
        onPaid();
        return;
      }
      setPending(true);
      poll();
    } catch (err) {
      setError(err instanceof ApiError ? err.messages.join(" ") : "Could not start the payment.");
    } finally {
      setBusy(false);
    }
  }

  function poll() {
    const interval = setInterval(async () => {
      try {
        const status = await contractorRegistrationApi.paymentStatus(token);
        if (status.paymentStatus === "paid") {
          clearInterval(interval);
          onPaid();
        }
      } catch {
        /* keep polling — a transient failure here shouldn't stop the flow */
      }
    }, 4000);
  }

  return (
    <div className="py-4 text-center">
      <h2 className="text-lg font-bold text-ink">Registration fee</h2>
      <p className="mt-2 text-sm text-muted">
        A one-time registration fee of <span className="font-semibold text-ink">₦{fee.toLocaleString()}</span> is
        required before you can submit your documents.
      </p>

      {pending && (
        <p className="mt-4 text-sm text-ink">Complete the payment in the popup, then wait a moment — we&rsquo;re confirming it.</p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-[4px] bg-red-light px-4 py-3 text-sm text-red">
          {error}
        </p>
      )}

      <Button className="mt-6 h-12 w-full" disabled={busy || pending} onClick={pay}>
        {busy ? "Starting payment…" : pending ? "Waiting for payment…" : `Pay ₦${fee.toLocaleString()}`}
      </Button>
    </div>
  );
}

function RegistrationForm({
  token,
  view,
  onSubmitted,
}: {
  token: string;
  view: ContractorRegistrationView;
  onSubmitted: () => void;
}) {
  const existing = view.existing;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await contractorRegistrationApi.submit(token, form);
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.messages.join(" ") : "Could not submit your registration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <h2 className="text-lg font-bold text-ink">Your details</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="name" label="Name" placeholder="Full name" defaultValue={existing?.name} required />
        <Input name="companyName" label="Company name" placeholder="Company" defaultValue={existing?.companyName} required />
        <Input name="phone" label="Phone number (optional)" placeholder="090873636366" defaultValue={existing?.phone} />
        <Input name="nationality" label="Nationality" placeholder="Nigerian" defaultValue={existing?.nationality} required />
        <Input
          name="addressOfContractor"
          label="Address of contractor"
          placeholder="Address"
          defaultValue={existing?.addressOfContractor}
          required
        />
        <Input
          name="permanentAddress"
          label="Permanent address"
          placeholder="Address"
          defaultValue={existing?.permanentAddress}
          required
        />
        <Input
          name="officeAddress"
          label="Office address"
          placeholder="Address"
          defaultValue={existing?.officeAddress}
          required
        />
        <Input name="rcNumber" label="RC number" placeholder="RC1234567" defaultValue={existing?.rcNumber} required />
        <Input name="tin" label="TIN" placeholder="12345678-0001" defaultValue={existing?.tin} required />
        <Input
          name="bppRegistrationDate"
          label="BPP registration date"
          type="date"
          defaultValue={existing?.bppRegistrationDate?.slice(0, 10)}
          required
        />
      </div>

      <h2 className="mt-2 text-lg font-bold text-ink">Documents</h2>
      <p className="-mt-2 text-xs text-muted">All documents below are required (images or PDFs).</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {DOCUMENT_FIELDS.map(([name, label]) => (
          <div key={name} className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-ink">{label}</label>
            <input name={name} type="file" accept="image/*,.pdf" className={inputClass} required />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-ink">Passport photo 1 of 2</label>
          <input name="passportPhotos" type="file" accept="image/*" className={inputClass} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-ink">Passport photo 2 of 2</label>
          <input name="passportPhotos" type="file" accept="image/*" className={inputClass} required />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-[4px] bg-red-light px-4 py-3 text-sm text-red">
          {error}
        </p>
      )}

      <Button type="submit" className="h-12" disabled={busy}>
        {busy ? "Submitting…" : "Submit registration"}
      </Button>
    </form>
  );
}
