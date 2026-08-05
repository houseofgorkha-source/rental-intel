"use client";

import { useEffect, useRef, useState } from "react";

type AreaSelectorProps = {
  areas: string[];
  value: string | null;
  onChange: (area: string | null) => void;
};

export default function AreaSelector({ areas, value, onChange }: AreaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selectorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filteredAreas = areas.filter((area) =>
    area.toLowerCase().includes(query.toLowerCase()),
  );
  // Index 0 is always the "All areas" option; real areas follow at indices 1..n.
  const optionCount = filteredAreas.length + 1;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen]);

  function closeMenu() {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function selectArea(area: string | null) {
    onChange(area);
    closeMenu();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeMenu();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % optionCount);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + optionCount) % optionCount);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex === 0) {
        selectArea(null);
      } else {
        selectArea(filteredAreas[activeIndex - 1]);
      }
    }
  }

  return (
    <div ref={selectorRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="area-options"
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
          value
            ? "border-blue-600 bg-blue-600 text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.45)]"
            : "border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-blue-200 hover:text-blue-600"
        }`}
      >
        {value ?? "Area"}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 z-30 mt-3 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-100 p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search areas..."
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-controls="area-options"
              aria-activedescendant={`area-option-${activeIndex}`}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500"
            />
          </div>

          <div id="area-options" role="listbox" className="max-h-64 overflow-y-auto overscroll-contain p-2">
            <button
              id="area-option-0"
              ref={(element) => {
                optionRefs.current[0] = element;
              }}
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => selectArea(null)}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-900 hover:bg-blue-50 ${
                activeIndex === 0 ? "bg-slate-50" : ""
              }`}
            >
              All areas
            </button>

            {filteredAreas.length > 0 ? (
              filteredAreas.map((area, index) => (
                <button
                  key={area}
                  id={`area-option-${index + 1}`}
                  ref={(element) => {
                    optionRefs.current[index + 1] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={value === area}
                  onClick={() => selectArea(area)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50 ${
                    activeIndex === index + 1 ? "bg-slate-50" : ""
                  }`}
                >
                  {area}
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-center text-sm text-slate-500">
                No matching areas
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
