import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fbfbfa] px-6 text-center">
      <h1 className="text-2xl font-medium tracking-[-0.03em] text-slate-950">
        Page not found
      </h1>
      <p className="max-w-md text-sm leading-6 text-slate-600">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Back to home
      </Link>
    </main>
  );
}
