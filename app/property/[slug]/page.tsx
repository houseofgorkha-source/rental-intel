type PropertyPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function PropertyPage({
  params,
}: PropertyPageProps) {
  const { slug } = await params;

  const propertyName = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <main className="min-h-screen bg-gray-100 py-10">
      <div className="mx-auto max-w-5xl px-6">

        <h1 className="text-5xl font-bold text-gray-900">
          {propertyName}
        </h1>

        <p className="mt-2 text-lg text-gray-600">
          Whitefield, Bengaluru
        </p>

        <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Overall Trust Score
          </p>

          <div className="mt-3 flex items-center gap-4">
            <span className="text-6xl font-extrabold text-[#1B4332]">
              8.9
            </span>

            <div>
              <p className="text-xl text-yellow-500">★★★★★</p>
              <p className="text-gray-500">
                Based on 127 verified tenant reviews
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}