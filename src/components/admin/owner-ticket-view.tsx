'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadError, PageHead } from './super-kit';
import { Button } from '@/components/ui/submit-button';
import { TextArea } from '@/components/ui/text-area';
import { useToast } from '@/components/ui/toast';
import { OT } from '@/hooks/use-owner-tickets';
import { CATEGORY_LABEL, TICKET_STATUS_LABEL, sortedMessages, supportApi, ticketBadgeClass, type Ticket } from '@/lib/api/support';
import { parseError } from '@/lib/errors';
import { ATTACHMENT_TYPES, MAX_ATTACHMENT, needsReply } from '@/lib/owner-tickets';
import { PRIORITY_LABEL, priorityBadge } from '@/lib/super-admin';
import { timeAgo } from '@/lib/time-ago';

const fmt = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fileName = (url: string) => { try { return decodeURIComponent(url.split('?')[0].split('/').pop() || 'attachment'); } catch { return 'attachment'; } };

export function OwnerTicketView({ id }: { id: string }) {
  const qc = useQueryClient();
  const { push } = useToast();
  const q = useQuery({
    queryKey: OT.one(id),
    queryFn: () => supportApi.get(id),
    retry: false,
    refetchInterval: 30_000,
    initialData: () => qc.getQueryData<{ tickets: Ticket[] }>(OT.list)?.tickets.find((t) => t.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(OT.list)?.dataUpdatedAt,
  });
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const t = q.data;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!ATTACHMENT_TYPES.includes(f.type)) return setError('Attach an image (JPG, PNG, WebP, GIF) or a PDF.');
    if (f.size > MAX_ATTACHMENT) return setError('That file is larger than 5 MB. Choose a smaller one.');
    setError(null);
    setFile(f);
  }

  async function send() {
    const message = text.trim();
    if (!message) { setError(file ? 'Add a short message to go with your attachment.' : 'Write a reply first.'); return; }
    setSending(true); setError(null);
    try {
      await supportApi.addMessage(id, message, file);
      setText(''); setFile(null);
      await qc.invalidateQueries({ queryKey: OT.one(id) });
      await qc.invalidateQueries({ queryKey: OT.list });
      push('Reply sent');
    } catch (e) {
      setError(parseError(e).display);
    } finally {
      setSending(false);
    }
  }

  if (q.isPending) return (<><PageHead title="Ticket" description="Loading…" /><div className="ad-skel" style={{ height: 260, borderRadius: 16 }} aria-busy="true" aria-label="Loading ticket" /></>);
  if (q.isError || !t) {
    const err = q.error ? parseError(q.error) : null;
    return (
      <>
        <PageHead title="Ticket" description="" actions={<Link className="btn btn-ghost" href="/owner/tickets">← All tickets</Link>} />
        {err?.status === 404 ? <div className="card ad-empty" role="alert"><strong>We couldn’t find that ticket</strong><span>It may belong to another restaurant, or it was removed.</span></div> : <LoadError query={q} what="this ticket" />}
      </>
    );
  }

  const closed = t.status === 'CLOSED';
  const waiting = needsReply(t);
  return (
    <>
      <PageHead title={t.subject} description={`${t.ticket_id} · opened ${timeAgo(t.created_at)}`} actions={<Link className="btn btn-ghost" href="/owner/tickets">← All tickets</Link>} />
      <div className="su-detail">
        <div className="ad-stack">
          <section className="card ad-card-pad" aria-label="Conversation">
            <h2 className="ad-card-title">Conversation</h2>
            <ol className="su-thread">
              <li className="su-msg">
                <div className="su-msg-h"><strong>{t.customer_email}</strong><span>{fmt(t.created_at)}</span></div>
                <p>{t.description}</p>
              </li>
              {sortedMessages(t).map((m) => (
                <li key={m.id} className={`su-msg ${m.message_type === 'STAFF_MESSAGE' ? 'staff' : ''}`}>
                  <div className="su-msg-h"><strong>{m.message_type === 'STAFF_MESSAGE' ? `Restaurant · ${m.sender_email}` : m.sender_email}</strong><span>{fmt(m.created_at)}</span></div>
                  <p>{m.message}</p>
                  {m.attachment && <a className="an-link" href={m.attachment} target="_blank" rel="noreferrer noopener">Attachment: {fileName(m.attachment)} ↗</a>}
                </li>
              ))}
            </ol>
          </section>

          <section className="card ad-card-pad" aria-label="Reply">
            {closed ? <p className="an-note">This ticket is closed. Replies are turned off.</p> : (
              <form className="su-reply" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                <TextArea label="Reply to the guest" rows={4} value={text} maxLength={2000} onChange={(e) => { setText(e.target.value); setError(null); }} error={error ?? undefined} />
                {file && (
                  <div className="an-note" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>📎 {file.name}</span>
                    <Button type="button" variant="ghost" onClick={() => setFile(null)} aria-label={`Remove attachment ${file.name}`}>Remove</Button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Button type="submit" loading={sending} loadingText="Sending…">Send reply</Button>
                  <input ref={fileInput} type="file" hidden accept={ATTACHMENT_TYPES.join(',')} onChange={onPick} aria-label="Attach a file" />
                  <Button type="button" variant="ghost" disabled={sending} onClick={() => fileInput.current?.click()}>Attach a photo or PDF</Button>
                </div>
              </form>
            )}
          </section>
        </div>

        <aside className="ad-stack">
          <section className="card ad-card-pad" aria-label="Ticket details">
            <h2 className="ad-card-title">Details</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className={`badge ${ticketBadgeClass(t.status) || 'badge-neutral'}`}>{TICKET_STATUS_LABEL[t.status]}</span>
              <span className={`badge ${priorityBadge(t.priority)}`}>{PRIORITY_LABEL[t.priority] ?? t.priority}</span>
              {waiting && <span className="badge badge-warn">Your reply</span>}
            </div>
            <dl className="su-facts">
              <dt>Guest</dt><dd>{t.customer_email}</dd>
              <dt>Category</dt><dd>{CATEGORY_LABEL[t.category] ?? t.category}</dd>
              <dt>Order</dt><dd>{t.related_order ? <Link className="an-link" href={`/owner/orders/${t.related_order}`}>View the order →</Link> : '—'}</dd>
              <dt>Messages</dt><dd>{t.messages.length + 1}</dd>
            </dl>
            <p className="an-note">Only the guest or the platform team can close a ticket. Your replies keep it moving.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
