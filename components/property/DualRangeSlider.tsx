"use client";

type DualRangeSliderProps = {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  formatValue: (value: number) => string;
  disabled?: boolean;
};

// Two overlapping native <input type="range"> thumbs sharing one visual
// track. Each input keeps its own min/max/value so browser drag behavior
// stays native (accessible, touch-friendly) — no pointer-event math needed.
export default function DualRangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  formatValue,
  disabled = false,
}: DualRangeSliderProps) {
  const [low, high] = value;
  const lowPercent = ((low - min) / (max - min)) * 100;
  const highPercent = ((high - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between text-sm font-medium text-slate-900">
        <span>{formatValue(low)}</span>
        <span>{formatValue(high)}</span>
      </div>
      <div className="relative mt-3 h-5">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-600"
          style={{ left: `${lowPercent}%`, right: `${100 - highPercent}%` }}
        />
        <input
          type="range"
          aria-label="Minimum"
          min={min}
          max={max}
          step={step}
          value={low}
          disabled={disabled}
          onChange={(event) => {
            const next = Math.min(Number(event.target.value), high - step);
            onChange([next, high]);
          }}
          className="range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
        <input
          type="range"
          aria-label="Maximum"
          min={min}
          max={max}
          step={step}
          value={high}
          disabled={disabled}
          onChange={(event) => {
            const next = Math.max(Number(event.target.value), low + step);
            onChange([low, next]);
          }}
          className="range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}
