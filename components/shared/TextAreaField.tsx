type TextAreaFieldProps = {
  label: string;
  placeholder: string;
  helperText?: string;
  required?: boolean;
  rows?: number;
  name?: string;
  defaultValue?: string;
};

export default function TextAreaField({
  label,
  placeholder,
  helperText,
  required = false,
  rows = 4,
  name,
  defaultValue,
}: TextAreaFieldProps) {
  return (
    <div className="space-y-2">

      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>

      <textarea
        rows={rows}
        name={name}
        defaultValue={defaultValue}
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
          resize-none
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
