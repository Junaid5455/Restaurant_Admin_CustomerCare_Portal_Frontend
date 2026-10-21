'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { PasswordField, TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import { parseError } from '@/lib/errors';
import { safeNext } from '@/lib/roles';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
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
      router.replace(safeNext(params.get('next'), user.role));
    } catch (e) {
      // The backend reports bad credentials under the "email" key; show it as a form-level message.
      setFormError(parseError(e).display);
    }
  });

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Savoria account.">
      <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {params.get('reset') && <Alert kind="success">Password updated. Sign in with your new password.</Alert>}
        {params.get('expired') && <Alert kind="info">Your session expired. Please sign in again.</Alert>}
        {formError && <Alert>{formError}</Alert>}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
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
          New customer?{' '}
          <Link href="/register" className="link">
            Create an account
          </Link>
        </p>
        <p style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 13, marginTop: -6 }}>
          Run a restaurant?{' '}
          <Link href="/owner/login" className="link">
            Team sign-in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
