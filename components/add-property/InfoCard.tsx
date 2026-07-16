type InfoCardProps = {
  title: string;
  children: React.ReactNode;
};

export default function InfoCard({
  title,
  children,
}: InfoCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

      <h3 className="text-lg font-semibold text-gray-900">
        {title}
      </h3>

      <div className="mt-3 text-sm leading-7 text-gray-600">
        {children}
      </div>

    </div>
  );
}