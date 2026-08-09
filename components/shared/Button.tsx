"use client";
import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
};

export default function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  ...props
}: ButtonProps) {
  // `disabled:pointer-events-none` rather than overriding each variant's
  // hover colours: both are single-class utilities, so a `disabled:hover:*`
  // rule would depend on Tailwind's variant ordering to win. Removing pointer
  // events makes the hover state unreachable instead, which is deterministic
  // and is the conventional pattern. Applies to both variants.
  const baseClasses =
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]";

  const variants = {
    primary:
      "bg-accent text-white shadow-[0_0_0_1px_rgba(14,143,94,0.35)] hover:bg-accent-hover hover:shadow-[0_10px_28px_-8px_rgba(14,143,94,0.6)] hover:-translate-y-0.5",

    secondary:
      "border border-border-subtle bg-surface text-foreground hover:border-accent hover:text-accent hover:bg-surface-raised hover:-translate-y-0.5",
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
