"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "../shared/Button";
import AuthHeader from "../shared/AuthHeader";
import AuthCard from "../shared/AuthCard";
import InputField from "../shared/InputField";

export default function SignupForm() {
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
    const { error: authError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) setError(authError.message);
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

      <div className="my-8 flex items-center">

        <div className="h-px flex-1 bg-gray-200" />
        <span className="px-4 text-sm text-gray-500">OR</span>
        <div className="h-px flex-1 bg-gray-200" />

      </div>

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

      {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}

      <p className="mt-8 text-center text-sm text-gray-500">
        Already have an account?
      </p>

      <div className="mt-3 text-center">

        <Link
          href="/login"
          className="font-medium text-blue-600 hover:underline"
        >
          Sign In
        </Link>

      </div>

    </AuthCard>
  );
}
