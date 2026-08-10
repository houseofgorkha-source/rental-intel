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

      {/* The 🏠 emoji + "RentalIntel" label that used to live here was a
          leftover from before the site had a real header logo — it now sits
          close enough to the persistent global header's own logo (Logo.tsx)
          to visually overlap/duplicate it, especially on mobile where
          there's less vertical room. Removed rather than kept as
          redundant branding. */}
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {title}
      </h1>

      <p className="mt-3 text-muted">
        {description}
      </p>

    </div>
  );
}