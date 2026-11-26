"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { PageTitle, PageCard } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { contractorsApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type { Contractor } from "@/lib/types";

const inputClass =
  "h-11 w-full rounded-[4px] border border-border bg-white px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-border focus:border-primary";

/**
 * The CDS approves a contractor's letter offline, outside this system —
 * once that's happened, the Procurement Admin sends this link. The
 * contractor fills in their own company details, pays the fee, and uploads
 * documents on the public registration page; this form only needs the
 * email and validity window. See FRONTEND_INTEGRATION_GUIDE.md §4.4.
 */
export default function ProcurementInvitePage() {
  const [invited, setInvited] = useState<Contractor | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registrationLink =
    invited?.registrationToken && typeof window !== "undefined"
      ? `${window.location.origin}/contractor-registration/${invited.registrationToken}`
      : null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    setError(null);
    try {
      const contractor = await contractorsApi.invite({
        email: String(form.get("email") ?? ""),
        validityFrom: String(form.get("from") ?? ""),
        validityTo: String(form.get("to") ?? ""),
      });
      setInvited(contractor);
      setCopied(false);
      // e.currentTarget is nulled by the time the await above resolves, so the
      // element reference has to be captured beforehand.
      formEl.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.messages.join(" ") : "Could not invite this contractor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageTitle>Invite Contractor</PageTitle>

      <PageCard className="px-7 py-7">
        <h2 className="mb-6 text-2xl font-bold text-ink">Invite a new contractor</h2>

        <form onSubmit={handleSubmit}>
          <div className="mx-auto max-w-[480px]">
            <div className="overflow-hidden rounded-[10px] border border-border">
              <div className="flex flex-col gap-4 px-8 py-7">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-ink">Email address</label>
                  <input name="email" className={inputClass} placeholder="Email" type="email" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-ink">Validity period</label>
                  <div className="flex items-stretch overflow-hidden rounded-[4px] border border-border">
                    <span className="flex items-center bg-grey px-3 text-sm font-semibold text-ink">From</span>
                    <input
                      name="from"
                      type="date"
                      className="h-11 min-w-0 flex-1 px-3 text-sm text-ink outline-none"
                      required
                    />
                    <span className="flex items-center bg-grey px-3 text-sm font-semibold text-ink">To</span>
                    <input
                      name="to"
                      type="date"
                      className="h-11 min-w-0 flex-1 px-3 text-sm text-ink outline-none"
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-muted">
                  We&rsquo;ll email them a registration link where they fill in their company details, pay the
                  registration fee, and upload the required documents.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-6 rounded-[4px] bg-red-light px-4 py-3 text-center text-sm text-red">
              {error}
            </p>
          )}

          <div className="mt-8 flex justify-center">
            <Button type="submit" className="h-[52px] w-[390px]" disabled={busy}>
              {busy ? "Inviting…" : "Send invite"}
            </Button>
          </div>
        </form>
      </PageCard>

      <Modal open={!!invited} onClose={() => setInvited(null)} title="Invitation sent">
        <div className="px-7 py-6">
          <p className="text-sm text-ink">
            An invite has been emailed to <span className="font-semibold">{invited?.email}</span>. If they need the
            link directly, you can copy it below.
          </p>
          {registrationLink && (
            <div className="mt-4 flex items-center gap-2 rounded-[4px] border border-dashed border-primary bg-primary-light px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-xs text-ink">{registrationLink}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(registrationLink).then(() => setCopied(true));
                }}
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
          <Button fullWidth className="mt-6" onClick={() => setInvited(null)}>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}
