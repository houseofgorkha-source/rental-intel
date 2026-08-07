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
  "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
  primary:
    "border border-gray-300 bg-white text-gray-900 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100",

  secondary:
    "border border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50",
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