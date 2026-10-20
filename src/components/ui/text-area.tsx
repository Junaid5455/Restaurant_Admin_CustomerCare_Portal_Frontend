import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Show "n / max" under the field. */
  counter?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, Props>(function TextArea(
  { label, error, hint, counter, className, maxLength, value, ...rest },
  ref,
) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        className={clsx('input', 'sv-textarea', error && 'input-error', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        maxLength={maxLength}
        value={value}
        {...rest}
      />
      <div className="sv-field-foot">
        {error ? (
          <p id={`${id}-err`} className="field-error" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} className="field-hint">
            {hint}
          </p>
        ) : (
          <span />
        )}
        {counter && maxLength && typeof value === 'string' && (
          <span className="sv-count" aria-hidden="true">
            {value.length} / {maxLength}
          </span>
        )}
      </div>
    </div>
  );
});
