import type { ReactNode } from 'react';
import clsx from 'clsx';

const ICON = { error: '⚠️', success: '✓', info: 'ℹ️' } as const;

export function Alert({ kind = 'error', children }: { kind?: keyof typeof ICON; children: ReactNode }) {
  return (
    <div className={clsx('alert', `alert-${kind}`)} role={kind === 'error' ? 'alert' : 'status'}>
      <span aria-hidden="true">{ICON[kind]}</span>
      <div>{children}</div>
    </div>
  );
}
