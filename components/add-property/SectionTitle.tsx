type SectionTitleProps = {
  title: string;
  description?: string;
};

export default function SectionTitle({
  title,
  description,
}: SectionTitleProps) {
  return (
    <div className="mb-6">

      <h2 className="text-xl font-semibold tracking-tight text-gray-900">
        {title}
      </h2>

      {description && (
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {description}
        </p>
      )}

    </div>
  );
}