"use client";

import { useEffect, useRef, useState } from "react";

const cities = ["Bangalore", "Hyderabad", "Pune", "Chennai"];

export default function CitySelector() {
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

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      closeMenu();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index + 1) % cities.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index - 1 + cities.length) % cities.length);
      return;
    }

    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      if (activeIndex === 0) closeMenu();
    }
  }

  return (
    <div
      ref={selectorRef}
      className="relative h-full shrink-0"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
          setActiveIndex(0);
        }}
        aria-expanded={isOpen}
        aria-controls="city-options"
        className="flex h-full min-h-16 items-center rounded-l-[0.9375rem] border-r border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 transition hover:bg-blue-50"
      >
        Bangalore
      </button>

      {isOpen && (
        <div
          id="city-options"
          role="menu"
          className="absolute left-0 z-30 mt-3 max-h-64 w-56 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
        >
          {cities.map((city, index) => {
            const available = city === "Bangalore";
            const isActive = activeIndex === index;

            return (
              <button
                key={city}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="menuitem"
                disabled={!available}
                onClick={() => available && closeMenu()}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${
                  available
                    ? "font-medium text-slate-900 hover:bg-blue-50"
                    : "cursor-not-allowed text-slate-400"
                } ${isActive ? "bg-slate-50" : ""}`}
              >
                {city}
                {!available && <span className="text-xs">Coming Soon</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
