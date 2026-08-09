"use client";

import { useState } from "react";

type PropertyShareButtonProps = {
  propertyName: string;
};

export default function PropertyShareButton({
  propertyName,
}: PropertyShareButtonProps) {
  const [label, setLabel] = useState("Share");

  async function shareProperty() {
    const shareData = {
      title: propertyName,
      text: `See renter experiences for ${propertyName} on RentalIntel.`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      setLabel("Link copied");
      window.setTimeout(() => setLabel("Share"), 2000);
    } catch {
      // A dismissed native share sheet is not an application error.
    }
  }

  return (
    <button
      type="button"
      onClick={shareProperty}
      className="flex w-full items-center justify-center rounded-xl border border-border-subtle px-4 py-3 text-sm font-medium text-foreground transition hover:bg-surface-raised"
    >
      {label}
    </button>
  );
}
