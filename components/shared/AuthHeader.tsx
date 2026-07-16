type AuthHeaderProps = {
  title: string;
  description: string;
};

export default function AuthHeader({
  title,
  description,
}: AuthHeaderProps) {
  return (
    <div className="text-center">

      <div className="text-5xl">🏠</div>

      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
        RentalIntel
      </p>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
        {title}
      </h1>

      <p className="mt-3 text-gray-600">
        {description}
      </p>

    </div>
  );
}