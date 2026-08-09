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
      <label className="block text-sm font-medium text-gray-800">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
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
          border-gray-200
          bg-white
          px-4
          py-3
          text-gray-900
          outline-none
          transition
          hover:border-gray-400
          focus:border-blue-600
          focus:ring-2
          focus:ring-blue-100
        "
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {helperText && <p className="text-sm text-gray-500">{helperText}</p>}
    </div>
  );
}
