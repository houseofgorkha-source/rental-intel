"use client";

type StarRatingProps = {
  label: string;
  value: number;
  onChange: (rating: number) => void;
  required?: boolean;
};

export default function StarRating({
  label,
  value,
  onChange,
  required = false,
}: StarRatingProps) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
      <h3 className="mb-3 text-lg font-semibold text-foreground">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </h3>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            aria-label={`${label}: ${star} out of 5 stars`}
            aria-pressed={star === value}
            className="text-4xl transition hover:scale-110"
          >
            <span
              className={
                star <= value
                  ? "text-yellow-400"
                  : "text-muted"
              }
            >
              ★
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
