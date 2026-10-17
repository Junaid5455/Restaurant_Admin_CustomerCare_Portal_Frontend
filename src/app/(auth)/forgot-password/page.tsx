'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { TextField } from '@/components/ui/text-field';
import { authApi } from '@/lib/api/auth';
import { parseError } from '@/lib/errors';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
});
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      await authApi.forgotPassword(email);
      setSentTo(email);
    } catch (e) {
      const err = parseError(e);
      // The API answers 400 "User with this email not found" for unknown addresses.
      // Show the same neutral confirmation so the UI doesn't reveal which emails are registered.
      if (err.status === 400 && err.fieldErrors.email) {
        setSentTo(email);
        return;
      }
      setFormError(err.display);
    }
  });

  if (sentTo) {
    return (
      <AuthShell title="Check your inbox">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert kind="success">
            If an account exists for <strong>{sentTo}</strong>, we've sent a link to reset your password. It expires in 2 hours.
          </Alert>
          <p className="field-hint">Nothing there? Check spam, or try again in a minute.</p>
          <Button variant="ghost" block onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
          <Link href="/login" className="link" style={{ textAlign: 'center' }}>
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {formError && <Alert>{formError}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" block loading={isSubmitting} loadingText="Sending…">
          Send reset link
        </Button>
        <Link href="/login" className="link" style={{ textAlign: 'center' }}>
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
