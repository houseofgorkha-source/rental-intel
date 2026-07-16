"use client";

import Link from "next/link";
import Button from "../shared/Button";

export default function LoginForm() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8">

      <div className="text-center">

  <div className="text-5xl">🏠</div>

  <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
    RentalIntel
  </p>

  <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
    Welcome Back
  </h1>

  <p className="mt-3 text-gray-600">
    Sign in to write reviews, add properties, and help future renters.
  </p>

</div>

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
        By continuing, you agree to our Terms and Privacy Policy.
      </p>

      <div className="mt-8 text-center">

        <Link
          href="/"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back to Home
        </Link>

      </div>

    </div>
  );
}