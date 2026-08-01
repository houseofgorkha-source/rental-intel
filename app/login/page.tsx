import AuthLayout from "@/components/shared/AuthLayout";
import LoginForm from "@/components/login/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthLayout>
      <LoginForm nextPath={next} callbackError={error} />
    </AuthLayout>
  );
}
