"use client";

import { useEffect, useRef, useState } from "react";

type AreaMultiSelectProps = {
  areas: string[];
  value: string[];
  onChange: (areas: string[]) => void;
  // "pill" (default): standalone rounded chip. "embedded-middle": flush
  // segment with no rounding, sitting between two other bar segments (e.g.
  // City and the search input) — used by HomeSearch's unified bar.
  variant?: "pill" | "embedded-middle";
};

// Same dropdown/keyboard-nav shape as AreaSelector (open/close, arrow-key
// index, search-to-filter) but toggles multiple selections instead of
// replacing a single one. The trigger shows a truncated summary of the
// selection ("Whitefield +3") rather than a bare count, and the removable
// chip list lives inside the open dropdown panel — the trigger's own box
// never grows with the selection, so the bar it sits in stays a fixed
// height no matter how many areas are picked. Kept as a separate component
// rather than reworking AreaSelector in place, since /property page depends
// on AreaSelector's existing single-value contract — disclosed as added
// dropdown-scaffolding duplication, not hidden.
function summarizeSelection(value: string[]): string {
  if (value.length === 0) return "Area";
  if (value.length === 1) return value[0];
  return `${value[0]} +${value.length - 1}`;
}
export default function AreaMultiSelect({
  areas,
  value,
  onChange,
  variant = "pill",
}: AreaMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selectorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filteredAreas = areas.filter((area) =>
    area.toLowerCase().includes(query.toLowerCase()),
  );

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

  function toggleArea(area: string) {
    onChange(value.includes(area) ? value.filter((item) => item !== area) : [...value, area]);
  }

  function removeArea(area: string) {
    onChange(value.filter((item) => item !== area));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeMenu();
      return;
    }

    if (filteredAreas.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filteredAreas.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + filteredAreas.length) % filteredAreas.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const area = filteredAreas[activeIndex];
      if (area) toggleArea(area);
    }
  }

  return (
    <div
      ref={selectorRef}
      className={
        variant === "embedded-middle" ? "relative h-full flex-1 sm:flex-none sm:shrink-0" : "relative"
      }
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="area-multi-options"
        className={
          variant === "embedded-middle"
            ? `flex h-full w-full items-center justify-center gap-1.5 border-r border-border-subtle px-4 text-sm font-medium transition sm:w-auto sm:justify-start ${
                value.length > 0 ? "text-accent" : "text-muted hover:bg-accent/10"
              }`
            : `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                value.length > 0
                  ? "border-accent bg-accent text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.45)]"
                  : "border-border-subtle bg-surface text-muted shadow-[0_1px_2px_rgba(14,143,94,0.04)] hover:border-accent/30 hover:text-accent"
              }`
        }
      >
        <span className="max-w-[9rem] truncate">{summarizeSelection(value)}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 z-30 mt-3 w-64 overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xl">
          {value.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b border-border-subtle p-3">
              {value.map((area) => (
                <span
                  key={area}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-raised py-1 pl-3 pr-2 text-xs font-medium text-muted"
                >
                  {area}
                  <button
                    type="button"
                    onClick={() => removeArea(area)}
                    aria-label={`Remove ${area}`}
                    className="rounded-full p-0.5 text-muted transition hover:bg-surface-raised hover:text-foreground"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="border-b border-border-subtle p-2">
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
              aria-controls="area-multi-options"
              aria-activedescendant={
                filteredAreas.length > 0 ? `area-multi-option-${activeIndex}` : undefined
              }
              className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
            />
          </div>

          <div
            id="area-multi-options"
            role="listbox"
            aria-multiselectable="true"
            className="max-h-64 overflow-y-auto overscroll-contain p-2"
          >
            {filteredAreas.length > 0 ? (
              filteredAreas.map((area, index) => {
                const isSelected = value.includes(area);
                return (
                  <button
                    key={area}
                    id={`area-multi-option-${index}`}
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleArea(area)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-accent/10 ${
                      isSelected ? "font-medium text-foreground" : "text-muted"
                    } ${activeIndex === index ? "bg-surface-raised" : ""}`}
                  >
                    {area}
                    {isSelected && <span aria-hidden="true">✓</span>}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-4 text-center text-sm text-muted">No matching areas</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
