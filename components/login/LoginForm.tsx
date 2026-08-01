"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "../shared/Button";
import AuthHeader from "../shared/AuthHeader";
import AuthCard from "../shared/AuthCard";
import InputField from "../shared/InputField";

export default function LoginForm({ nextPath, callbackError }: { nextPath?: string; callbackError?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(callbackError ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const { error: authError } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/")}` },
    });
    setIsSubmitting(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setMessage("Check your email for a sign-in link.");
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const { error: authError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/")}` },
    });
    if (authError) setError(authError.message);
  };

  return (
    <AuthCard>

      <AuthHeader
  title="Welcome Back"
  description="Sign in to write reviews, add properties, and help future renters."
/>

      <div className="mt-10">
        <Button type="button" fullWidth onClick={handleGoogleLogin}>
          Continue with Google
        </Button>
      </div>

      <div className="my-8 flex items-center">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="px-4 text-sm text-gray-500">OR</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <form onSubmit={handleEmailLogin}>
      <div>

        <InputField
  label="Email Address"
  type="email"
  placeholder="you@example.com"
  name="email"
  required
/>

      </div>

      <Button fullWidth className="mt-8" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Continue"}
      </Button>
      </form>

      {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}

      <p className="mt-8 text-center text-sm text-gray-500">
  Don&apos;t have an account?
</p>

<div className="mt-3 text-center">

  <Link
    href="/signup"
    className="font-medium text-blue-600 hover:underline"
  >
    Create Account
  </Link>

</div>

<div className="mt-8 text-center">

  <Link
    href="/"
    className="text-sm text-gray-500 hover:text-blue-600"
  >
    ← Back to Home
  </Link>

</div>
    </AuthCard>
  );
}
