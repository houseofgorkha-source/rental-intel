"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWishlisted } from "@/app/actions/wishlist";

type WishlistButtonProps = {
  slug: string;
  isSignedIn: boolean;
  initialSaved: boolean;
  // True when the page was reached as ?wishlist=add — i.e. the visitor clicked
  // this button while signed out and has just come back through login.
  pendingSave?: boolean;
};

// "Add to wishlist" for a signed-in user, and a route into login for everyone
// else.
//
// The signed-out path is the whole point of the pendingSave dance: sending
// somebody to log in and then dropping the thing they asked for makes the
// button feel broken. So the intent travels through the login round trip in
// the `next` path, and is completed here on the way back.
export default function WishlistButton({
  slug,
  isSignedIn,
  initialSaved,
  pendingSave = false,
}: WishlistButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  // Guards against the completion running twice — React re-runs effects in
  // development's strict mode, and a second save would be harmless but a
  // second history replace would not.
  const hasCompletedPendingSave = useRef(false);

  function save(desired: boolean) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("slug", slug);
      formData.set("desired", String(desired));
      const result = await setWishlisted(formData);

      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(Boolean(result.saved));
    });
  }

  useEffect(() => {
    if (!pendingSave || !isSignedIn || saved || hasCompletedPendingSave.current) return;
    hasCompletedPendingSave.current = true;
    save(true);
    // Drop ?wishlist=add so a refresh or a shared link doesn't silently
    // re-save a property the user may have since removed.
    router.replace(`/property/${slug}`, { scroll: false });
    // `save` is stable enough for this one-shot completion; re-running on
    // every render is exactly what the ref above prevents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSave, isSignedIn, saved, slug, router]);

  function handleClick() {
    if (!isSignedIn) {
      // Encoded as a single component so the nested query string survives the
      // round trip intact — an unencoded `?wishlist=add` would be parsed as a
      // parameter of /login and lost.
      const next = encodeURIComponent(`/property/${slug}?wishlist=add`);
      router.push(`/login?next=${next}`);
      return;
    }
    save(!saved);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={isSignedIn ? saved : undefined}
        aria-busy={isPending}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 ${
          saved
            ? "border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "border-slate-200 bg-white text-slate-900 hover:border-blue-300 hover:text-blue-700"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`h-4 w-4 stroke-current stroke-[1.8] ${saved ? "fill-current" : "fill-none"}`}
        >
          <path
            d="M12 20.25S3.75 15 3.75 9.4A4.15 4.15 0 0 1 12 7.2a4.15 4.15 0 0 1 8.25 2.2c0 5.6-8.25 10.85-8.25 10.85z"
            strokeLinejoin="round"
          />
        </svg>
        {saved ? "Saved to wishlist" : "Add to wishlist"}
      </button>

      {error && (
        <p role="alert" className="text-xs leading-5 text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
