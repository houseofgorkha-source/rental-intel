import { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
};

export default function AuthCard({
  children,
}: AuthCardProps) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8">
      {children}
    </div>
  );
}