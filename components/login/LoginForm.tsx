"use client";

import Link from "next/link";
import Button from "../shared/Button";
import AuthHeader from "../shared/AuthHeader";
import AuthCard from "../shared/AuthCard";
import InputField from "../shared/InputField";
import TextAreaField from "../shared/TextAreaField";

export default function LoginForm() {
  return (
    <AuthCard>

      <AuthHeader
  title="Welcome Back"
  description="Sign in to write reviews, add properties, and help future renters."
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

      <div>

        <label className="mb-2 block font-medium text-gray-900">
          Email Address
        </label>

        <input
          type="email"
          placeholder="you@example.com"
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-colors focus:border-blue-600"
        />

      </div>

      <Button fullWidth className="mt-8">
        Continue
      </Button>

      <p className="mt-8 text-center text-sm text-gray-500">
  Don't have an account?
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