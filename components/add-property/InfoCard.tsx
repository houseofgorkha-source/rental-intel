type InfoCardProps = {
  title: string;
  children: React.ReactNode;
};

export default function InfoCard({
  title,
  children,
}: InfoCardProps) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">

      <h3 className="text-lg font-semibold text-foreground">
        {title}
      </h3>

      <div className="mt-3 text-sm leading-7 text-muted">
        {children}
      </div>

    </div>
  );
}