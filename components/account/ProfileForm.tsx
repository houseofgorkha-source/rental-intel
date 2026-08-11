"use client";

import { FormEvent, useState } from "react";
import { updateProfile } from "@/app/actions/profile";
import InputField from "@/components/shared/InputField";
import Button from "@/components/shared/Button";

type ProfileFormProps = {
  displayName: string;
  email: string;
};

export default function ProfileForm({ displayName, email }: ProfileFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaved(false);
    setIsSubmitting(true);

    const result = await updateProfile(new FormData(event.currentTarget));
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setIsSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6">
      <div className="space-y-6">
        <InputField
          label="Display Name"
          placeholder="How you appear on reviews"
          name="displayName"
          defaultValue={displayName}
          required
          helperText="Shown on reviews you haven't marked anonymous."
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Email</label>
          <p className="rounded-lg border border-border-subtle bg-surface-raised px-4 py-3 text-sm text-muted">
            {email}
          </p>
          <p className="text-sm text-muted">
            Your email is managed by your sign-in method and can&apos;t be changed here.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 text-sm text-danger">
          {error}
        </p>
      )}

      {isSaved && !error && (
        <p className="mt-5 text-sm font-medium text-success">Profile updated.</p>
      )}

      <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-6">
        {isSubmitting ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
