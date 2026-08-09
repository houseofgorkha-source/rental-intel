import { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
};

export default function AuthCard({
  children,
}: AuthCardProps) {
  return (
    <div className="glow-accent w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-8">
      {children}
    </div>
  );
}