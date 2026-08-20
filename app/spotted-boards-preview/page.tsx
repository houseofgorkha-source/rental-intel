import { notFound } from "next/navigation";
import SpottedBoardsPreviewSection from "@/components/spotted-boards-preview/SpottedBoardsPreviewSection";
import type { PreviewDataset } from "@/lib/spotted-boards-preview";
import dataset from "@/data/spotted-boards-dataset.json";

export const metadata = {
  title: "To-Let Board Detection Preview | RentalIntel",
  description: "A technical preview of boards automatically detected from Street View imagery by the tolet-vision pipeline.",
};

// Dev-only preview, same gate as DeveloperNavigationMenu.tsx — this is a
// static export of an experimental detection pipeline's output, not a
// finished user-facing feature, and not backed by Supabase. Off by default
// (see .env.example); on locally via .env.local while this is being built.
export default function SpottedBoardsPreviewPage() {
  if (process.env.NEXT_PUBLIC_SHOW_DEV_NAV !== "true") {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <SpottedBoardsPreviewSection dataset={dataset as PreviewDataset} />
    </main>
  );
}
