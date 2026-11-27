"use client";

import { Suspense, useRef, useState } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";

const CODE_LENGTH = 4;

/**
 * The 4-digit code from the forgot-password email, entered as separate
 * digit boxes (auto-advancing focus, paste-the-whole-code support) rather
 * than one text field — matches the backend's short numeric reset code.
 */
function CodeInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < CODE_LENGTH - 1) inputs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    onChange(Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? ""));
    inputs.current[Math.min(pasted.length, CODE_LENGTH) - 1]?.focus();
  }

  return (
    <div className="flex justify-center gap-3">
      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="h-14 w-14 rounded-[4px] border border-border bg-white text-center text-xl font-semibold text-ink outline-none transition-colors focus:border-primary"
        />
      ))}
    </div>
  );
}

/** The code from the forgot-password email, plus a new password — `POST /auth/reset-password`. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const trimmedEmail = email.trim();
    const token = code.join("");
    const newPassword = String(form.get("newPassword") ?? "").trim();
    const confirmPassword = String(form.get("confirmPassword") ?? "").trim();

    setError(null);
    if (!trimmedEmail) {
      setError("Enter the email you requested the code with.");
      return;
    }
    if (token.length < CODE_LENGTH) {
      setError(`Enter the full ${CODE_LENGTH}-digit code.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(trimmedEmail, token, newPassword);
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
          <p className="mt-1 text-sm text-muted">Enter the 4-digit code from your email, then choose a new password.</p>
        </div>

        <Input
          name="email"
          label="Email"
          type="email"
          placeholder="Email address"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <CodeInput value={code} onChange={setCode} />
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
