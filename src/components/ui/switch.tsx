import { useId, type ReactNode } from 'react';
import clsx from 'clsx';

/**
 * A labelled on/off setting. Uses a real checkbox with role="switch" so keyboard, screen readers and
 * forms behave natively; the visible track is drawn in CSS (.sv-switch).
 */
export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled,
  busy,
  note,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Saving this one right now. Keeps the control usable for screen readers but ignores clicks. */
  busy?: boolean;
  /** Extra line shown under the description (e.g. why it is unavailable). */
  note?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={clsx('sv-setting', disabled && 'is-disabled')}>
      <div className="sv-setting-text">
        <label className="sv-setting-label" htmlFor={id}>{label}</label>
        {description && <p className="sv-setting-desc" id={`${id}-d`}>{description}</p>}
        {note && <p className="sv-setting-note">{note}</p>}
      </div>
      <span className={clsx('sv-switch', checked && 'on', busy && 'busy')}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={description ? `${id}-d` : undefined}
          aria-busy={busy || undefined}
          onChange={(e) => { if (!busy) onChange(e.target.checked); }}
        />
        <span className="sv-switch-track" aria-hidden="true"><span className="sv-switch-thumb" /></span>
      </span>
    </div>
  );
}
