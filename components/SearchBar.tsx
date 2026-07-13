"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const searchData = [
  "Prestige Lakeside Habitat",
  "Prestige Shantiniketan",
  "Prestige Falcon City",
  "Brigade Cornerstone Utopia",
  "Sobha Dream Acres",
  "Whitefield",
  "HSR Layout",
  "Electronic City",
];

export default function SearchBar() {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filteredResults = searchData.filter((item) =>
    item.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative mt-12 w-full max-w-3xl">
      <div className="flex overflow-hidden rounded-full border border-gray-300 bg-white shadow-md focus-within:border-[#1B4332]">

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search properties, landlords, brokers, societies or areas..."
          className="flex-1 px-7 py-3 text-base text-black placeholder:text-gray-400 bg-white outline-none"
        />

        <button className="bg-[#1B4332] px-6 text-white hover:bg-[#2D6A4F]">
          🔍
        </button>

      </div>

      {search && (
        <div className="absolute mt-2 w-full overflow-hidden rounded-2xl border bg-white shadow-lg">

          {filteredResults.length > 0 ? (
            filteredResults.map((item) => (
              <div
  key={item}
  onClick={() => {
  const slug = item
    .toLowerCase()
    .replace(/\s+/g, "-");

  router.push(`/property/${slug}`);
}}
  className="cursor-pointer px-6 py-3 text-black hover:bg-gray-100"
>
  {item}
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