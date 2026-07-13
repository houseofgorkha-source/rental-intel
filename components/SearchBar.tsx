"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { properties } from "../data/properties";

export default function SearchBar() {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filteredResults = properties.filter((property) =>
    property.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative mt-12 w-full max-w-3xl">
      <div className="flex overflow-hidden rounded-full border border-gray-300 bg-white shadow-md focus-within:border-[#1B4332]">

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search properties, landlords, brokers, societies or areas..."
          className="flex-1 bg-white px-7 py-3 text-base text-black placeholder:text-gray-400 outline-none"
        />

        <button className="bg-[#1B4332] px-6 text-white transition hover:bg-[#2D6A4F]">
          🔍
        </button>

      </div>

      {search && (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">

          {filteredResults.length > 0 ? (
            filteredResults.map((property) => (
              <div
                key={property.slug}
                onClick={() => router.push(`/property/${property.slug}`)}
                className="cursor-pointer px-6 py-3 text-black transition hover:bg-gray-100"
              >
                {property.name}
              </div>
            ))
          ) : (
            <div className="px-6 py-3 text-gray-600">
              No results found.
            </div>
          )}

        </div>
      )}
    </div>
  );
}