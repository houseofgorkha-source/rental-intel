"use client";

import { useEffect, useRef, useState } from "react";
import { CITIES, DEFAULT_CITY } from "@/lib/cities";

type CitySelectorProps = {
  value?: string;
  onChange?: (city: string) => void;
  // "embedded" (default) sits flush as SearchBar's leftmost segment.
  // "pill" is a standalone rounded chip, matching AreaSelector/Filters in a
  // toolbar context.
  variant?: "embedded" | "pill";
};

export default function CitySelector({ value, onChange, variant = "embedded" }: CitySelectorProps) {
  const [internalCity, setInternalCity] = useState(DEFAULT_CITY);
  const city = value ?? internalCity;
  const setCity = onChange ?? setInternalCity;

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectorRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (isOpen) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen]);

  function closeMenu() {
    setIsOpen(false);
    setActiveIndex(0);
  }

  function selectCity(name: string) {
    setCity(name);
    closeMenu();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      closeMenu();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index + 1) % CITIES.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index - 1 + CITIES.length) % CITIES.length);
      return;
    }

    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      const option = CITIES[activeIndex];
      if (option?.available) selectCity(option.name);
    }
  }

  return (
    <div
      ref={selectorRef}
      className={variant === "embedded" ? "relative h-full shrink-0" : "relative"}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
          setActiveIndex(0);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="city-options"
        className={
          variant === "embedded"
            ? "flex h-full items-center rounded-l-[0.9375rem] border-r border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 transition hover:bg-blue-50"
            : "inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-blue-200 hover:text-blue-600"
        }
      >
        {city}
      </button>

      {isOpen && (
        <div
          id="city-options"
          role="listbox"
          className="absolute left-0 z-30 mt-3 max-h-64 w-56 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
        >
          {CITIES.map((option, index) => {
            const isActive = activeIndex === index;

            return (
              <button
                key={option.name}
                id={`city-option-${index}`}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={city === option.name}
                disabled={!option.available}
                onClick={() => option.available && selectCity(option.name)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${
                  option.available
                    ? "font-medium text-slate-900 hover:bg-blue-50"
                    : "cursor-not-allowed text-slate-400"
                } ${isActive ? "bg-slate-50" : ""}`}
              >
                {option.name}
                {!option.available && <span className="text-xs">Coming Soon</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
