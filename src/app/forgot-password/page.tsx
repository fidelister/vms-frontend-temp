"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";

/**
 * `POST /auth/forgot-password` always responds success, even for an email
 * that doesn't exist (no account enumeration) — so this screen always shows
 * the same confirmation regardless of what the API actually did.
 */
export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setError(null);
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.messages.join(" ") : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="flex w-full flex-col gap-4">
          <h2 className="text-lg font-bold text-ink">Check your email</h2>
          <p className="text-sm text-muted">
            If an account exists for that email, we&rsquo;ve sent a reset code to it. The code expires in 30
            minutes.
          </p>
          <Link href="/reset-password">
            <Button fullWidth>Enter reset code</Button>
          </Link>
          <Link href="/login" className="text-center text-sm text-muted hover:text-ink hover:underline">
            Back to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold text-ink">Forgot your password?</h2>
          <p className="mt-1 text-sm text-muted">
            Enter the email address on your account and we&rsquo;ll send you a code to reset it.
          </p>
        </div>

        <Input name="email" label="Email" type="email" placeholder="Email address" autoComplete="email" required />

        {error && (
          <p role="alert" className="rounded-[4px] bg-red-light px-4 py-3 text-sm text-red">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "Sending…" : "Send reset code"}
        </Button>

        <Link href="/login" className="text-center text-sm text-muted hover:text-ink hover:underline">
          Back to login
        </Link>
      </form>
    </AuthLayout>
  );
}
