import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, hint, optional, className, ...rest },
  ref,
) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {optional && <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}> (optional)</span>}
      </label>
      <input
        id={id}
        ref={ref}
        className={clsx('input', error && 'input-error', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <p id={`${id}-err`} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(
  { label, error, hint, className, ...rest },
  ref,
) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={clsx('input', error && 'input-error', className)}
          style={{ paddingRight: 64 }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <button
          type="button"
          className="pw-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
