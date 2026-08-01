import AuthLayout from "@/components/shared/AuthLayout";
import SignupForm from "@/components/login/SignupForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthLayout>
      <SignupForm nextPath={next} />
    </AuthLayout>
  );
}
