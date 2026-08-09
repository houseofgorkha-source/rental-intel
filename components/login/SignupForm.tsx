"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSafeNextPath } from "@/lib/safe-next-path";
import { signInWithGoogle } from "@/lib/auth-client";
import Button from "../shared/Button";
import AuthHeader from "../shared/AuthHeader";
import AuthCard from "../shared/AuthCard";
import AuthDivider from "../shared/AuthDivider";
import InputField from "../shared/InputField";

export default function SignupForm({ nextPath }: { nextPath?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const { error: authError } = await createClient().auth.signInWithOtp({
      email: String(formData.get("email") || "").trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeNextPath(nextPath))}`,
        data: { full_name: String(formData.get("fullName") || "").trim() },
      },
    });
    setIsSubmitting(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setMessage("Check your email to confirm your account.");
  };

  const handleGoogleSignup = async () => {
    setError(null);
    const { error: authError } = await signInWithGoogle(nextPath);
    if (authError) setError(authError);
  };

  return (
    <AuthCard>

      <AuthHeader
  title="Create Account"
  description="Join RentalIntel and help renters make smarter decisions."
/>

      <div className="mt-10">

        <Button type="button" fullWidth onClick={handleGoogleSignup}>
          Continue with Google
        </Button>

      </div>

      <AuthDivider />

      <form onSubmit={handleSignup} className="space-y-6">

  <InputField
    label="Full Name"
    placeholder="John Doe"
    name="fullName"
    required
  />

  <InputField
    label="Email Address"
    type="email"
    placeholder="you@example.com"
    name="email"
    required
  />

      <Button fullWidth className="mt-8" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Create Account"}
      </Button>
      </form>

      {message && <p className="mt-4 text-sm text-success">{message}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?
      </p>

      <div className="mt-3 text-center">

        <Link
          href="/login"
          className="font-medium text-accent hover:underline"
        >
          Sign In
        </Link>

      </div>

    </AuthCard>
  );
}
