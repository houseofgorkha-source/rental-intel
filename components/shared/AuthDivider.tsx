export default function AuthDivider() {
  return (
    <div className="my-8 flex items-center">
      <div className="h-px flex-1 bg-border-subtle" />
      <span className="px-4 text-sm text-muted">OR</span>
      <div className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}
