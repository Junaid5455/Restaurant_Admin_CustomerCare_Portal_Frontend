import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'ghost';
  block?: boolean;
}

export function Button({ loading, loadingText, variant = 'primary', block, className, children, disabled, ...rest }: Props) {
  return (
    <button
      className={clsx('btn', variant === 'primary' ? 'btn-primary' : 'btn-ghost', block && 'btn-block', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
