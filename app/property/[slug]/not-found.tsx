import Link from "next/link";

export default function PropertyNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-2xl font-medium tracking-[-0.03em] text-foreground">
        Property not found
      </h1>
      <p className="max-w-md text-sm leading-6 text-muted">
        This property doesn&apos;t exist, isn&apos;t published yet, or may have moved.
      </p>
      <Link
        href="/property"
        className="mt-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
      >
        Browse properties
      </Link>
    </main>
  );
}
