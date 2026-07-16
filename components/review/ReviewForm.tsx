"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StarRating from "./StarRating";

const reviewCategories = [
  { id: "owner", label: "Owner Behaviour" },
  { id: "maintenance", label: "Maintenance" },
  { id: "water", label: "Water Supply" },
  { id: "security", label: "Security" },
  { id: "cleanliness", label: "Cleanliness" },
];

const issueOptions = [
  "Deposit Delay",
  "Deposit Deduction",
  "Hidden Charges",
  "Water Issues",
  "Power Issues",
  "Noise",
  "Parking",
  "Safety",
  "Owner Behaviour",
  "Maintenance",
  "Broker Issues",
  "Pet Restrictions",
  "Other",
];

export default function ReviewForm() {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [issues, setIssues] = useState<string[]>([]);
  const router = useRouter();

  const toggleIssue = (issue: string) => {
    setIssues((prev) =>
      prev.includes(issue)
        ? prev.filter((i) => i !== issue)
        : [...prev, issue]
    );
  };

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-8">

      <div className="space-y-6">

        {reviewCategories.map((category) => (
          <StarRating
            key={category.id}
            label={category.label}
            value={ratings[category.id] ?? 0}
            onChange={(value) =>
              setRatings({
                ...ratings,
                [category.id]: value,
              })
            }
          />
        ))}

      </div>

      <div className="mt-8">

        <label className="mb-2 block font-medium text-gray-900">
          Review Title
        </label>

        <input
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-colors focus:border-blue-600"
          placeholder="Deposit returned within 10 days"
        />

      </div>

      <div className="mt-6">

        <label className="mb-2 block font-medium text-gray-900">
          Share Your Experience
        </label>

        <textarea
          rows={6}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-colors focus:border-blue-600"
          placeholder="Tell future tenants what went well..."
        />

      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">

        <input
          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-colors focus:border-blue-600"
          placeholder="Monthly Rent"
        />

        <input
          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-colors focus:border-blue-600"
          placeholder="Security Deposit"
        />

      </div>

      <div className="mt-8">

        <h2 className="mb-3 font-semibold text-gray-900">
          Would you recommend this property?
        </h2>

        <div className="flex gap-6">

          <label className="text-gray-700">
            <input className="mr-2" type="radio" name="recommend" />
            Yes
          </label>

          <label className="text-gray-700">
            <input className="mr-2" type="radio" name="recommend" />
            Maybe
          </label>

          <label className="text-gray-700">
            <input className="mr-2" type="radio" name="recommend" />
            No
          </label>

        </div>

      </div>

      <div className="mt-8">

        <h2 className="mb-3 font-semibold text-gray-900">
          Problems Experienced
        </h2>

        <div className="grid gap-3 md:grid-cols-2">

          {issueOptions.map((issue) => (
            <label key={issue} className="text-gray-700">

              <input
                className="mr-2"
                type="checkbox"
                checked={issues.includes(issue)}
                onChange={() => toggleIssue(issue)}
              />

              {issue}

            </label>
          ))}

        </div>

      </div>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">

        <h2 className="font-semibold text-gray-900">
          Current Verification Status
        </h2>

        <p className="mt-2 text-gray-700">
          ⚪ Unverified
        </p>

        <p className="mt-2 text-sm text-gray-600">
          You can verify later by uploading supporting documents.
        </p>

      </div>

      <button
        type="button"
        onClick={() => router.push(window.location.pathname + "/success")}
        className="mt-10 w-full rounded-full bg-blue-600 px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Publish My Experience
      </button>

    </div>
  );
}