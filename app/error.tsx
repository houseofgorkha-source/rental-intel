"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fbfbfa] px-6 text-center">
      <h1 className="text-2xl font-medium tracking-[-0.03em] text-slate-950">
        Something went wrong
      </h1>
      <p className="max-w-md text-sm leading-6 text-slate-600">
        We couldn&apos;t load this page. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Try again
      </button>
    </main>
  );
}
