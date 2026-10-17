'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { PasswordField, TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import { authApi } from '@/lib/api/auth';
import { parseError } from '@/lib/errors';

const schema = z
  .object({
    first_name: z.string().trim().max(150, 'Too long'),
    last_name: z.string().trim().max(150, 'Too long'),
    email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .max(15, 'Phone numbers can be at most 15 characters')
      .regex(/^[+\d][\d\s-]*$|^$/, 'Use digits only (a leading + is fine)'),
    password: z.string().min(8, 'Use at least 8 characters'),
    password_confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.password_confirm, {
    message: "Passwords don't match",
    path: ['password_confirm'],
  });
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: signUp } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: '', last_name: '', email: '', phone: '', password: '', password_confirm: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUp(values);
    } catch (e) {
      const err = parseError(e);
      let placed = false;
      for (const [field, message] of Object.entries(err.fieldErrors)) {
        if (field in values) {
          setError(field as keyof Values, { message });
          placed = true;
        }
      }
      if (err.formErrors.length || !placed) setFormError(err.formErrors[0] ?? err.message);
      return;
    }

    // Signed in. Registration doesn't send a verification email or create notification
    // preferences on its own, so do both now. Neither should block the signup.
    await Promise.allSettled([authApi.requestVerification(), authApi.createDefaultPreferences()]);
    router.replace('/verify-email?welcome=1');
  });

  return (
    <AuthShell title="Create your account" subtitle="Order from your favourite restaurants in a few taps.">
      <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {formError && <Alert>{formError}</Alert>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextField
            label="First name"
            autoComplete="given-name"
            optional
            error={errors.first_name?.message}
            {...register('first_name')}
          />
          <TextField
            label="Last name"
            autoComplete="family-name"
            optional
            error={errors.last_name?.message}
            {...register('last_name')}
          />
        </div>

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          optional
          placeholder="+92 300 1234567"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          error={errors.password_confirm?.message}
          {...register('password_confirm')}
        />

        <Button type="submit" block loading={isSubmitting} loadingText="Creating account…">
          Create account
        </Button>

        <p style={{ textAlign: 'center', color: 'var(--fg-2)' }}>
          Already have an account?{' '}
          <Link href="/login" className="link">
            Sign in
          </Link>
        </p>
        <p className="field-hint" style={{ textAlign: 'center' }}>
          Restaurant owners, kitchen staff and drivers are set up by the restaurant or platform admin.
        </p>
      </form>
    </AuthShell>
  );
}
