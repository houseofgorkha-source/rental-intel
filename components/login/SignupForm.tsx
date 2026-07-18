"use client";

import Link from "next/link";
import Button from "../shared/Button";
import AuthHeader from "../shared/AuthHeader";
import AuthCard from "../shared/AuthCard";
import InputField from "../shared/InputField";

export default function SignupForm() {
  return (
    <AuthCard>

      <AuthHeader
  title="Create Account"
  description="Join RentalIntel and help renters make smarter decisions."
/>

      <div className="mt-10">

        <Button fullWidth>
          Continue with Google
        </Button>

      </div>

      <div className="my-8 flex items-center">

        <div className="h-px flex-1 bg-gray-200" />
        <span className="px-4 text-sm text-gray-500">OR</span>
        <div className="h-px flex-1 bg-gray-200" />

      </div>

      <div className="space-y-6">

  <InputField
    label="Full Name"
    placeholder="John Doe"
    required
  />

  <InputField
    label="Email Address"
    type="email"
    placeholder="you@example.com"
    required
  />

</div>
      <Button fullWidth className="mt-8">
        Create Account
      </Button>

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
