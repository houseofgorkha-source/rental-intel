import AuthLayout from "@/components/shared/AuthLayout";
import SignupForm from "@/components/login/SignupForm";

export default function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
}