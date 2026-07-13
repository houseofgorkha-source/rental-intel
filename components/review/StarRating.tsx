"use client";

type StarRatingProps = {
  label: string;
  value: number;
  onChange: (rating: number) => void;
};

export default function StarRating({
  label,
  value,
  onChange,
}: StarRatingProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-lg font-semibold text-gray-900">
        {label}
      </h3>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="text-4xl transition hover:scale-110"
          >
            <span
              className={
                star <= value
                  ? "text-yellow-400"
                  : "text-gray-300"
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