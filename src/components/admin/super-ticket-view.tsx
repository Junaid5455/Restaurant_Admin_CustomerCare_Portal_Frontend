'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadError, PageHead } from './super-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Button } from '@/components/ui/submit-button';
import { TextArea } from '@/components/ui/text-area';
import { useToast } from '@/components/ui/toast';
import { SA } from '@/hooks/use-super-admin';
import { CATEGORY_LABEL, TICKET_STATUS_LABEL, sortedMessages, supportApi, ticketBadgeClass, type Ticket } from '@/lib/api/support';
import { superAdminApi } from '@/lib/api/super-admin';
import { parseError } from '@/lib/errors';
import { PRIORITIES, PRIORITY_LABEL, priorityBadge } from '@/lib/super-admin';
import { timeAgo } from '@/lib/time-ago';

const fmt = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function SuperTicketView({ id }: { id: string }) {
  const qc = useQueryClient();
  const { push } = useToast();
  const q = useQuery({ queryKey: ['sa-ticket', id], queryFn: () => supportApi.get(id), retry: false, refetchInterval: 30_000, initialData: () => qc.getQueryData<{ tickets: Ticket[] }>(SA.tickets)?.tickets.find((t) => t.id === id), initialDataUpdatedAt: () => qc.getQueryState(SA.tickets)?.dataUpdatedAt });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const [prioBusy, setPrioBusy] = useState(false);
  const t = q.data;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['sa-ticket', id] });
    await qc.invalidateQueries({ queryKey: SA.tickets });
    await qc.invalidateQueries({ queryKey: SA.summary });
  };

  async function send() {
    const message = text.trim();
    if (!message) { setError('Write a reply first.'); return; }
    setSending(true); setError(null);
    try {
      await supportApi.addMessage(id, message);
      setText('');
      await refresh();
      push('Reply sent');
    } catch (e) {
      setError(parseError(e).display);
    } finally {
      setSending(false);
    }
  }

  async function close() {
    setCloseBusy(true);
    try {
      await supportApi.close(id);
      await refresh();
      push('Ticket closed');
      setClosing(false);
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      setCloseBusy(false);
    }
  }

  async function setPriority(p: string) {
    setPrioBusy(true);
    try {
      const next = await superAdminApi.setPriority(id, p);
      qc.setQueryData(['sa-ticket', id], (cur: Ticket | undefined) => (cur ? { ...cur, priority: next.priority ?? p } : cur));
      await qc.invalidateQueries({ queryKey: SA.tickets });
      push(`Priority set to ${PRIORITY_LABEL[p]?.toLowerCase() ?? p}`);
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      setPrioBusy(false);
    }
  }

  if (q.isPending) return (<><PageHead title="Ticket" description="Loading…" /><div className="ad-skel" style={{ height: 260, borderRadius: 16 }} aria-busy="true" aria-label="Loading ticket" /></>);
  if (q.isError || !t) {
    const err = q.error ? parseError(q.error) : null;
    return (
      <>
        <PageHead title="Ticket" description="" actions={<Link className="btn btn-ghost" href="/admin/support">← All tickets</Link>} />
        {err?.status === 404 ? <div className="card ad-empty" role="alert"><strong>We couldn’t find that ticket</strong><span>It may have been removed.</span></div> : <LoadError query={q} what="this ticket" />}
      </>
    );
  }

  const closed = t.status === 'CLOSED';
  return (
    <>
      <PageHead title={t.subject} description={`${t.ticket_id} · opened ${timeAgo(t.created_at)}`} actions={<Link className="btn btn-ghost" href="/admin/support">← All tickets</Link>} />
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
                  <div className="su-msg-h"><strong>{m.message_type === 'STAFF_MESSAGE' ? `Support · ${m.sender_email}` : m.sender_email}</strong><span>{fmt(m.created_at)}</span></div>
                  <p>{m.message}</p>
                  {m.attachment && <a className="an-link" href={m.attachment} target="_blank" rel="noreferrer noopener">Attachment ↗</a>}
                </li>
              ))}
            </ol>
          </section>

          <section className="card ad-card-pad" aria-label="Reply">
            {closed ? <p className="an-note">This ticket is closed. Replies are turned off.</p> : (
              <form className="su-reply" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                <TextArea label="Reply to the customer" rows={4} value={text} maxLength={2000} onChange={(e) => { setText(e.target.value); setError(null); }} error={error ?? undefined} />
                <div><Button type="submit" loading={sending} loadingText="Sending…">Send reply</Button></div>
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
            </div>
            <dl className="su-facts">
              <dt>Customer</dt><dd>{t.customer_email}</dd>
              <dt>Category</dt><dd>{CATEGORY_LABEL[t.category] ?? t.category}</dd>
              <dt>Order</dt><dd>{t.related_order ?? '—'}</dd>
              <dt>Restaurant</dt><dd>{t.restaurant ?? '—'}</dd>
            </dl>
            <label className="ad-filter">
              Priority
              <select className="ad-input" value={t.priority} disabled={prioBusy || closed} onChange={(e) => void setPriority(e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </label>
            {!closed && <Button variant="ghost" onClick={() => setClosing(true)}>Close ticket</Button>}
          </section>
        </aside>
      </div>
      {closing && <ConfirmDialog title="Close this ticket?" message="The customer is told it is closed and no more replies can be sent. They can open a new ticket if they still need help." confirmLabel="Close ticket" busy={closeBusy} onConfirm={() => void close()} onClose={() => setClosing(false)} />}
    </>
  );
}
