"use client";

import Link from "next/link";
import Button from "../shared/Button";
import AuthHeader from "../shared/AuthHeader";
import AuthCard from "../shared/AuthCard";
import InputField from "../shared/InputField";
import TextAreaField from "../shared/TextAreaField";

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

      <label className="mb-2 block font-medium text-gray-900">
        Full Name
      </label>

      <input
        type="text"
        placeholder="John Doe"
        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600"
      />

      <label className="mt-6 mb-2 block font-medium text-gray-900">
        Email Address
      </label>

      <input
        type="email"
        placeholder="you@example.com"
        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600"
      />

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