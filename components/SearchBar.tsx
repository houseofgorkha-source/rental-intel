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
  <>
    <div className="border-b bg-gray-50 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
      Search Results
    </div>

    {filteredResults.map((property) => (
      <div
        key={property.slug}
        onClick={() => router.push(`/property/${property.slug}`)}
        className="cursor-pointer px-6 py-3 transition hover:bg-gray-100"
      >
        <p className="font-semibold text-gray-900">
          {property.name}
        </p>

        <p className="text-sm text-gray-500">
          {property.location}
        </p>
      </div>
    ))}

    <div className="border-t"></div>

    <div
      onClick={() =>
        router.push(
          `/add-property?query=${encodeURIComponent(search)}`
        )
      }
      className="cursor-pointer bg-green-50 px-6 py-4 transition hover:bg-green-100"
    >
      <p className="font-semibold text-[#1B4332]">
        ➕ Can't find your property?
      </p>

      <p className="mt-1 text-sm text-gray-600">
        Add it to RentalIntel and help future tenants.
      </p>
    </div>
  </>
) : (
  <div className="p-6 text-center">

    <div className="text-5xl">
      🏠
    </div>

    <h3 className="mt-4 text-xl font-semibold text-gray-900">
      Can't find your property?
    </h3>

    <p className="mt-3 text-gray-600">
      Be the first to add it to RentalIntel and help future tenants make better rental decisions.
    </p>

    <button
      onClick={() =>
        router.push(
          `/add-property?query=${encodeURIComponent(search)}`
        )
      }
      className="mt-6 rounded-xl bg-[#1B4332] px-6 py-3 font-semibold text-white hover:bg-[#2D6A4F]"
    >
      Add This Property
    </button>

  </div>
)}

        </div>
      )}
    </div>
  );
}