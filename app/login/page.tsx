import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <LoginForm />
      </div>
    </main>
  );
}