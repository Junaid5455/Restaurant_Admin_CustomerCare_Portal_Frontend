'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/submit-button';
import { SafeImage } from '@/components/ui/safe-image';
import { initials, mediaUrl } from '@/lib/format';

const MAX_IMAGE = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type Active = 'items' | 'categories' | 'import';

/** Heading plus the Items / Categories / Import & export tabs. */
export function MenuFrame({ active, title, description, actions, children }: { active: Active; title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  const tabs: { id: Active; href: string; icon: string; text: string }[] = [
    { id: 'items', href: '/owner/menu', icon: '🍽', text: 'Items' },
    { id: 'categories', href: '/owner/menu/categories', icon: '🗂', text: 'Categories' },
    { id: 'import', href: '/owner/menu/import', icon: '⇅', text: 'Import & export' },
  ];
  return (
    <>
      <nav className="ad-tabs" aria-label="Menu sections">
        {tabs.map((t) => (
          <Link key={t.id} href={t.href} className={`ad-tab ${t.id === active ? 'active' : ''}`} aria-current={t.id === active ? 'page' : undefined}>
            <span aria-hidden="true">{t.icon}</span>
            {t.text}
          </Link>
        ))}
      </nav>
      <div className="ad-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions && <div className="ad-head-actions">{actions}</div>}
      </div>
      <div className="ad-stack">{children}</div>
    </>
  );
}

/** A compact on/off switch for table rows. */
export function MiniSwitch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`ad-mini-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

/** Small round/square picture of an item or category. */
export function Thumb({ src, name, size = 44 }: { src: string | null; name: string; size?: number }) {
  return (
    <span className="ad-thumb" style={{ width: size, height: size }} aria-hidden="true">
      <SafeImage src={mediaUrl(src)} alt="" fallback={<span>{initials(name) || '🍽'}</span>} />
    </span>
  );
}

export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Use a JPG, PNG, WebP or GIF image.';
  if (file.size > MAX_IMAGE) return 'That image is over 5 MB. Choose a smaller one.';
  return null;
}

/**
 * Picture picker. With `onUpload` the file is sent straight away (an item that already exists);
 * with `onPick` it is only chosen and previewed, to be sent when the form is saved.
 */
export function ImageField({
  label, hint, src, name, onUpload, onPick, onRemove,
}: {
  label: string;
  hint: string;
  src: string | null;
  name: string;
  onUpload?: (file: File) => Promise<void>;
  onPick?: (file: File | null) => void;
  onRemove?: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = validateImage(file);
    if (problem) return setError(problem);
    setError(null);
    if (onPick) {
      setPreview(URL.createObjectURL(file));
      onPick(file);
      return;
    }
    setBusy('upload');
    try {
      await onUpload?.(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that image.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (onPick) {
      setPreview(null);
      onPick(null);
      return;
    }
    setBusy('remove');
    setError(null);
    try {
      await onRemove?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the image.');
    } finally {
      setBusy(null);
    }
  }

  const shown = preview ?? mediaUrl(src);
  return (
    <div className="ad-image">
      <div className="ad-image-preview square" aria-hidden="true">
        <SafeImage src={shown} alt="" fallback={<span>{initials(name) || '🍽'}</span>} />
      </div>
      <div className="ad-image-side">
        <div className="ad-setting-label">{label}</div>
        <p className="ad-setting-desc">{hint}</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <input ref={input} type="file" accept={IMAGE_TYPES.join(',')} className="sr-only" tabIndex={-1} onChange={pick} aria-label={`Choose ${label.toLowerCase()}`} />
        <div className="ad-actions">
          <Button type="button" variant="ghost" loading={busy === 'upload'} loadingText="Uploading…" onClick={() => input.current?.click()}>
            {shown ? 'Replace picture' : 'Add a picture'}
          </Button>
          {shown && (onPick || onRemove) && (
            <button type="button" className="ad-link danger" disabled={busy !== null} onClick={remove}>
              {busy === 'remove' ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
