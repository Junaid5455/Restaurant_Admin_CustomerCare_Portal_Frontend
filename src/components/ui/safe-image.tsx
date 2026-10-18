'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { mediaUrl } from '@/lib/format';

/** <img> that makes /media/ URLs absolute and shows `fallback` when missing or broken. */
export function SafeImage({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const url = mediaUrl(src);
  if (!url || failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}
