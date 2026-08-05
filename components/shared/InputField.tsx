type InputFieldProps = {
  label: string;
  placeholder: string;
  required?: boolean;
  helperText?: string;
  type?: string;
  name?: string;
  accept?: string;
  multiple?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  // Optional — omitted by existing callers, which keeps the field
  // uncontrolled exactly as before. Passing it (with onChange) opts a
  // specific field into controlled mode, e.g. to prefill it programmatically.
  value?: string;
};

export default function InputField({
  label,
  placeholder,
  required = false,
  helperText,
  type = "text",
  name,
  accept,
  multiple = false,
  onChange,
  value,
}: InputFieldProps) {
  return (
    <div className="space-y-2">

      <label className="block text-sm font-medium text-gray-800">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <input
        type={type}
        name={name}
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        value={value}
        placeholder={placeholder}
        className="
          w-full
          rounded-lg
          border
          border-gray-200
          bg-white
          px-4
          py-3
          text-gray-900
          placeholder:text-gray-400
          outline-none
          transition
          hover:border-gray-400
          focus:border-[#1B4332]
          focus:ring-2
          focus:ring-green-100
        "
      />

      {helperText && (
        <p className="text-sm text-gray-500">
          {helperText}
        </p>
      )}

    </div>
  );
}
import type { ChangeEventHandler } from "react";
