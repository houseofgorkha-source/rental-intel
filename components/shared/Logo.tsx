import Link from "next/link";

type LogoProps = {
  className?: string;
};

export default function Logo({ className = "" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`inline-flex text-xs font-medium uppercase tracking-[0.14em] text-slate-900 transition hover:text-slate-600 ${className}`}
    >
      RentalIntel
    </Link>
  );
}
