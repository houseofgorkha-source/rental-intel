"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type VerifyStayPromptProps = {
  propertySlug: string;
  className?: string;
};

// Verification is only ever possible once a review exists (it's keyed to a
// reviewId minted at review-submission time — see review/verify/page.tsx).
// Rather than link straight to a page that can't function yet, this prompts
// the user to start where the journey actually begins.
export default function VerifyStayPrompt({ propertySlug, className }: VerifyStayPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          className ??
          "flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
        }
      >
        Verify Stay
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onMouseDown={(event) => {
            if (!dialogRef.current?.contains(event.target as Node)) setIsOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-stay-title"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="verify-stay-title" className="text-lg font-semibold text-slate-950">
              Verify Your Stay
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              To verify your stay, you first need to submit a review for this
              property.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Verification is linked to your review and helps us confirm that
              you genuinely lived here, making your contribution more
              trustworthy for future renters.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <Link
                href={`/property/${propertySlug}/review`}
                className="flex flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Write a Review
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
