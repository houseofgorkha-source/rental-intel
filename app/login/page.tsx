import AuthLayout from "@/components/shared/AuthLayout";
import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}