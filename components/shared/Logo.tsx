import Link from "next/link";

type LogoProps = {
  className?: string;
};

export default function Logo({ className = "" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`inline-flex text-xs font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:text-accent ${className}`}
    >
      RentalIntel
    </Link>
  );
}
