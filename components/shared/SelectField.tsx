import type { ChangeEventHandler } from "react";

type SelectFieldProps = {
  label: string;
  name: string;
  options: readonly string[];
  // The label for "no answer". Kept as a real option rather than making the
  // field required: most of these attributes are genuinely unknown to a
  // tenant or a community member adding a property they don't live in, and
  // forcing a guess would put wrong data behind a filter.
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  value?: string;
  defaultValue?: string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
};

// The select counterpart to InputField, matching its label/helper/border
// treatment exactly so a form can mix the two without looking assembled from
// two different kits.
export default function SelectField({
  label,
  name,
  options,
  placeholder = "Select an option",
  required = false,
  helperText,
  value,
  defaultValue,
  onChange,
}: SelectFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>

      <select
        name={name}
        required={required}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        className="
          w-full
          rounded-lg
          border
          border-border-subtle
          bg-surface
          px-4
          py-3
          text-foreground
          outline-none
          transition
          hover:border-muted
          focus:border-accent
          focus:ring-2
          focus:ring-accent/25
        "
      >
        <option value="" className="bg-surface text-foreground">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option} className="bg-surface text-foreground">
            {option}
          </option>
        ))}
      </select>

      {helperText && <p className="text-sm text-muted">{helperText}</p>}
    </div>
  );
}
