'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell, type AuthHero } from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { PasswordField, TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import { parseError } from '@/lib/errors';
import { safeNext } from '@/lib/roles';

const HERO: AuthHero = {
  brandSub: 'Restaurant Admin',
  heading: 'Your restaurant, at a glance.',
  blurb: 'See today’s orders and revenue, keep an eye on what needs attention, and look after your team and guests.',
  chips: ['📊 Live KPIs', '📋 Orders', '🎫 Guest support'],
};

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your work email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, logout } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);
      if (user.role === 'CUSTOMER') {
        // Right password, wrong door. Don't leave a customer session open behind a team page.
        await logout();
        setFormError('That is a customer account. Customers sign in on the main sign-in page.');
        return;
      }
      router.replace(safeNext(params.get('next'), user.role));
    } catch (e) {
      setFormError(parseError(e).display);
    }
  });

  return (
    <AuthShell title="Restaurant team sign-in" subtitle="Sign in to manage your restaurant." hero={HERO}>
      <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {params.get('expired') && <Alert kind="info">Your session expired. Please sign in again.</Alert>}
        {formError && <Alert>{formError}</Alert>}

        <TextField
          label="Work email"
          type="email"
          autoComplete="username"
          inputMode="email"
          placeholder="you@restaurant.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
          <Link href="/forgot-password" className="link" style={{ fontSize: 13 }}>
            Forgot password?
          </Link>
        </div>

        <Button type="submit" block loading={isSubmitting} loadingText="Signing in…">
          Sign in
        </Button>

        <p style={{ textAlign: 'center', color: 'var(--fg-2)' }}>
          Ordering food?{' '}
          <Link href="/login" className="link">
            Customer sign-in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
