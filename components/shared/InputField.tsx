import type { ChangeEventHandler } from "react";

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
  // Uncontrolled initial value, for fields that are prefilled once (e.g. the
  // listing edit form) but shouldn't become controlled.
  defaultValue?: string;
  // Numeric-input constraints. Ignored by every non-number field, and
  // omitted by every existing caller.
  min?: string;
  step?: string;
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
  defaultValue,
  min,
  step,
}: InputFieldProps) {
  return (
    <div className="space-y-2">

      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>

      <input
        type={type}
        name={name}
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        value={value}
        defaultValue={defaultValue}
        min={min}
        step={step}
        placeholder={placeholder}
        className="
          w-full
          rounded-lg
          border
          border-border-subtle
          bg-surface
          px-4
          py-3
          text-foreground
          placeholder:text-muted
          outline-none
          transition
          hover:border-muted
          focus:border-accent
          focus:ring-2
          focus:ring-accent/25
        "
      />

      {helperText && (
        <p className="text-sm text-muted">
          {helperText}
        </p>
      )}

    </div>
  );
}
