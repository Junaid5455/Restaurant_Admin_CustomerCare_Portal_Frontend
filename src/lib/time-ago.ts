/** "just now", "5m ago", "3h ago", "2d ago", then a short date. */
export function timeAgo(iso: string | number | null | undefined, now: number = Date.now()): string {
  const t = typeof iso === 'number' ? iso : Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
