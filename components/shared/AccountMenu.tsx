import Link from "next/link";
import { signOut } from "@/app/actions/auth";

type AccountMenuProps = {
  email: string;
};

export default function AccountMenu({ email }: AccountMenuProps) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:border-blue-600 hover:text-blue-600">
        Account
      </summary>

      <div className="absolute right-0 z-30 mt-3 w-52 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
        <p className="truncate px-3 py-2 text-xs text-gray-500">{email}</p>
        <span className="block px-3 py-2 text-sm text-gray-400">
          My Profile (coming soon)
        </span>
        <Link
          href="/add-property"
          className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
        >
          Add Property
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
          >
            Logout
          </button>
        </form>
      </div>
    </details>
  );
}
