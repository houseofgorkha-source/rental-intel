import SignupForm from "@/components/login/SignupForm";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <SignupForm />
      </div>
    </main>
  );
}