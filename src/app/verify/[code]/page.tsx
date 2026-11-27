"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { contractorRegistrationApi } from "@/lib/api/endpoints";
import type { ContractorVerification } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between border-b border-border py-2 text-left text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

/**
 * Public, no auth — what the QR code on the back of a contractor's ID card
 * resolves to. GET /contractor-registration/verify/:code always returns 200
 * with `{ verified: boolean, ... }`; an unknown code and a known-but-invalid
 * one (revoked, outside its validity window) both just come back
 * `verified: false` — there's no 404 case to special-case. See §4.4b.
 */
export default function VerifyContractorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [result, setResult] = useState<ContractorVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    contractorRegistrationApi
      .verify(code)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't check this code. Please try again shortly.");
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-grey px-6 py-12">
      <div className="w-full max-w-[420px] rounded-[10px] bg-white p-8 text-center shadow-sm">
        {error ? (
          <p role="alert" className="text-sm text-red">
            {error}
          </p>
        ) : !result ? (
          <p className="py-10 text-sm text-muted">Checking&hellip;</p>
        ) : result.verified ? (
          <>
            <p className="text-4xl">✅</p>
            <h1 className="mt-3 text-lg font-bold text-ink">Confirmed contractor</h1>
            <p className="mt-1 text-sm text-muted">{result.institutionName}</p>
            <div className="mt-6 flex flex-col items-center gap-4">
              {result.photoUrl && (
                <Image
                  src={result.photoUrl}
                  alt=""
                  width={96}
                  height={96}
                  className="h-24 w-24 rounded-full object-cover"
                />
              )}
              <div className="w-full">
                <Row label="Name" value={result.name} />
                <Row label="Company" value={result.companyName} />
                <Row label="ID number" value={result.idNumber} />
                <Row
                  label="Valid"
                  value={`${formatDate(result.validityFrom)} – ${formatDate(result.validityTo)}`}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-4xl">❌</p>
            <h1 className="mt-3 text-lg font-bold text-ink">Not confirmed</h1>
            <p className="mt-1 text-sm text-muted">This code isn&rsquo;t currently valid.</p>
          </>
        )}
      </div>
    </div>
  );
}
