"use client";

import Link from "next/link";
import Button from "../shared/Button";

export default function SignupForm() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8">

      <div className="text-center">

        <div className="text-5xl">🏠</div>

        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          RentalIntel
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
          Create Account
        </h1>

        <p className="mt-3 text-gray-600">
          Join RentalIntel and help renters make smarter decisions.
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

    </div>
  );
}