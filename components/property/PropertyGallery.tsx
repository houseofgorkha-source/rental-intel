"use client";

import { useState } from "react";

export type PropertyImage = {
  src: string;
  alt: string;
};

type PropertyGalleryProps = {
  images: PropertyImage[];
};

export default function PropertyGallery({ images }: PropertyGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(images[0]);

  if (!selectedImage) {
    return null;
  }

  return (
    <section aria-label="Property gallery" className="mt-10">
      <div className="overflow-hidden rounded-[1.5rem] border border-border-subtle bg-surface-raised shadow-[0_24px_60px_-45px_rgba(14,143,94,0.45)]">
        <img
          src={selectedImage.src}
          alt={selectedImage.alt}
          className="aspect-[16/10] w-full object-cover"
        />
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1 sm:mt-5">
        {images.map((image) => {
          const isSelected = image.src === selectedImage.src;

          return (
            <button
              key={image.src}
              type="button"
              onClick={() => setSelectedImage(image)}
              aria-label={`View ${image.alt}`}
              aria-pressed={isSelected}
              className={`shrink-0 overflow-hidden rounded-xl border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-subtle ${
                isSelected
                  ? "border-accent"
                  : "border-transparent opacity-70 hover:border-border-subtle hover:opacity-100"
              }`}
            >
              <img
                src={image.src}
                alt=""
                className="h-20 w-28 object-cover sm:h-24 sm:w-40"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
