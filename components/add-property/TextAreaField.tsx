type TextAreaFieldProps = {
  label: string;
  placeholder: string;
  helperText?: string;
  required?: boolean;
  rows?: number;
};

export default function TextAreaField({
  label,
  placeholder,
  helperText,
  required = false,
  rows = 4,
}: TextAreaFieldProps) {
  return (
    <div className="space-y-2">

      <label className="block text-sm font-medium text-gray-800">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <textarea
        rows={rows}
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
          resize-none
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