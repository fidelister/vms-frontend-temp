"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";

/** The code from the forgot-password email, plus a new password — `POST /auth/reset-password`. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const token = String(form.get("token") ?? "").trim();
    const newPassword = String(form.get("newPassword") ?? "").trim();
    const confirmPassword = String(form.get("confirmPassword") ?? "").trim();

    setError(null);
    if (newPassword !== confirmPassword) {
      setError("The new passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, newPassword);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.messages.join(" ")
          : "Could not reset your password. The code may be wrong or expired.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="flex w-full flex-col gap-4">
          <h2 className="text-lg font-bold text-ink">Password reset</h2>
          <p className="text-sm text-muted">Your password has been changed. Log in with your new password.</p>
          <Button fullWidth onClick={() => router.replace("/login")}>
            Go to login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold text-ink">Reset your password</h2>
          <p className="mt-1 text-sm text-muted">Enter the code from your email, then choose a new password.</p>
        </div>

        <Input name="token" label="Reset code" placeholder="Code from your email" autoComplete="off" required />
        <Input
          name="newPassword"
          label="New password"
          type="password"
          placeholder="••••••••••"
          autoComplete="new-password"
          required
        />
        <Input
          name="confirmPassword"
          label="Confirm new password"
          type="password"
          placeholder="••••••••••"
          autoComplete="new-password"
          required
        />

        {error && (
          <p role="alert" className="rounded-[4px] bg-red-light px-4 py-3 text-sm text-red">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "Resetting…" : "Reset password"}
        </Button>

        <Link href="/login" className="text-center text-sm text-muted hover:text-ink hover:underline">
          Back to login
        </Link>
      </form>
    </AuthLayout>
  );
}
