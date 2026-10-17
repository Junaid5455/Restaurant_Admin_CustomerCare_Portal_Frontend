'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { PasswordField } from '@/components/ui/text-field';
import { authApi } from '@/lib/api/auth';
import { parseError } from '@/lib/errors';

const schema = z
  .object({
    new_password: z.string().min(8, 'Use at least 8 characters'),
    new_password_confirm: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.new_password === v.new_password_confirm, {
    message: "Passwords don't match",
    path: ['new_password_confirm'],
  });
type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [tokenProblem, setTokenProblem] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: '', new_password_confirm: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setTokenProblem(false);
    try {
      await authApi.resetPassword(token, values.new_password, values.new_password_confirm);
      router.replace('/login?reset=1');
    } catch (e) {
      const err = parseError(e);
      let placed = false;
      for (const [field, message] of Object.entries(err.fieldErrors)) {
        if (field === 'new_password' || field === 'new_password_confirm') {
          setError(field, { message });
          placed = true;
        }
      }
      if (err.fieldErrors.token) {
        setFormError(err.fieldErrors.token);
        setTokenProblem(true);
        return;
      }
      if (err.formErrors.length) {
        setFormError(err.formErrors[0]);
        // Token validation failures arrive as non-field errors ("expired", "already used", "Invalid token").
        setTokenProblem(/token/i.test(err.formErrors[0]));
      } else if (!placed) {
        setFormError(err.message);
      }
    }
  });

  return (
    <AuthShell title="Set a new password" subtitle="Choose a password you haven't used before.">
      <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {formError && (
          <Alert>
            {formError}
            {tokenProblem && (
              <>
                {' '}
                <Link href="/forgot-password" className="link">
                  Request a new link
                </Link>
              </>
            )}
          </Alert>
        )}

        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.new_password?.message}
          {...register('new_password')}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.new_password_confirm?.message}
          {...register('new_password_confirm')}
        />

        <Button type="submit" block loading={isSubmitting} loadingText="Updating…">
          Update password
        </Button>
        <Link href="/login" className="link" style={{ textAlign: 'center' }}>
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
