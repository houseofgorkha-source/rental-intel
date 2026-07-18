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
    <section aria-label="Property gallery" className="mt-8">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
        <img
          src={selectedImage.src}
          alt={selectedImage.alt}
          className="aspect-[16/9] w-full object-cover"
        />
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {images.map((image) => {
          const isSelected = image.src === selectedImage.src;

          return (
            <button
              key={image.src}
              type="button"
              onClick={() => setSelectedImage(image)}
              aria-label={`View ${image.alt}`}
              aria-pressed={isSelected}
              className={`shrink-0 overflow-hidden rounded-xl border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
                isSelected
                  ? "border-blue-600"
                  : "border-transparent hover:border-gray-300"
              }`}
            >
              <img
                src={image.src}
                alt=""
                className="h-20 w-28 object-cover sm:h-24 sm:w-36"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
