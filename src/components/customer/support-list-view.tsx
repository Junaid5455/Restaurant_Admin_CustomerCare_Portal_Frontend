'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { useTickets } from '@/hooks/use-tickets';
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  TICKET_STATUS_LABEL,
  isActiveTicket,
  lastActivityAt,
  sortedMessages,
  ticketBadgeClass,
  type Ticket,
} from '@/lib/api/support';
import { parseError } from '@/lib/errors';
import { formatDateTime } from '@/lib/pickup';
import { hasNewReply, readSeen } from '@/lib/support-seen';

type Filter = 'active' | 'done' | 'all';

function preview(t: Ticket): string {
  const last = sortedMessages(t).at(-1);
  if (!last) return t.description;
  return `${last.message_type === 'CUSTOMER_MESSAGE' ? 'You' : 'Support'}: ${last.message || (last.attachment ? '📎 Attachment' : '')}`;
}

function TicketRow({ ticket: t, isNew }: { ticket: Ticket; isNew: boolean }) {
  return (
    <article className={`card sv-ticket ${isNew ? 'is-new' : ''}`} aria-label={`Ticket ${t.ticket_id}: ${t.subject}`}>
      <div className="sv-ticket-top">
        <div className="sv-ticket-id">
          <h2>
            <Link href={`/customer/support/${t.id}`} className="sv-ticket-link">{t.subject}</Link>
          </h2>
          <p>
            #{t.ticket_id} · {CATEGORY_ICON[t.category]} {CATEGORY_LABEL[t.category]} · {formatDateTime(t.created_at)}
          </p>
        </div>
        <div className="sv-ticket-badges">
          {isNew && <span className="badge badge-crit">New reply</span>}
          <span className={`badge ${ticketBadgeClass(t.status)}`}>{TICKET_STATUS_LABEL[t.status]}</span>
        </div>
      </div>
      <p className="sv-ticket-preview">{preview(t)}</p>
      <p className="sv-ticket-foot">
        {t.messages.length} {t.messages.length === 1 ? 'reply' : 'replies'} · Last activity {formatDateTime(new Date(lastActivityAt(t)).toISOString())}
      </p>
    </article>
  );
}

export function SupportListView() {
  const q = useTickets({ poll: true });
  const [filter, setFilter] = useState<Filter>('active');
  const [seen, setSeen] = useState<Record<string, string>>({});
  useEffect(() => setSeen(readSeen()), [q.dataUpdatedAt]);

  const all = useMemo(() => [...(q.data?.tickets ?? [])].sort((a, b) => lastActivityAt(b) - lastActivityAt(a)), [q.data]);
  const counts = useMemo(
    () => ({ active: all.filter(isActiveTicket).length, done: all.filter((t) => !isActiveTicket(t)).length, all: all.length }),
    [all],
  );
  const shown = all.filter((t) => (filter === 'all' ? true : filter === 'active' ? isActiveTicket(t) : !isActiveTicket(t)));
  const newReplies = all.filter((t) => hasNewReply(t, seen)).length;

  // First load with nothing active but history: show everything instead of an empty "Active" tab.
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (auto && q.data) {
      setAuto(false);
      if (counts.active === 0 && counts.done > 0) setFilter('done');
    }
  }, [auto, q.data, counts.active, counts.done]);

  return (
    <>
      <div className="sv-page-head sv-support-head">
        <div>
          <h1>Support</h1>
          <p>Questions or problems with an order? Open a ticket and chat with our team.</p>
        </div>
        <Link href="/customer/support/new" className="btn btn-primary">+ New ticket</Link>
      </div>

      {q.isPending ? (
        <div className="sv-tickets" aria-busy="true" aria-label="Loading your tickets">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="sv-skel" style={{ height: 116, borderRadius: 16 }} />)}
        </div>
      ) : !q.data ? (
        <div className="sv-acct-inline">
          <Alert>{parseError(q.error).display}</Alert>
          <Button variant="ghost" onClick={() => q.refetch()}>Try again</Button>
        </div>
      ) : all.length === 0 ? (
        <div className="sv-state">
          <div className="emoji" aria-hidden="true">🎫</div>
          <h2>No support tickets</h2>
          <p>If something went wrong with an order, or you just have a question, we’re here to help.</p>
          <Link href="/customer/support/new" className="btn btn-primary">Open a ticket</Link>
        </div>
      ) : (
        <>
          <div className="sv-seg" role="group" aria-label="Show tickets">
            {([['active', 'Active'], ['done', 'Resolved & closed'], ['all', 'All']] as const).map(([id, text]) => (
              <button key={id} type="button" aria-pressed={filter === id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
                {text}
                <span className="count">{counts[id]}</span>
              </button>
            ))}
          </div>

          <div className="sv-results-line" aria-live="polite">
            {newReplies > 0 && <span className="badge badge-crit">{newReplies} new {newReplies === 1 ? 'reply' : 'replies'}</span>}
            {q.data.total > all.length && <span>Showing your {all.length} most recent tickets.</span>}
          </div>

          {shown.length === 0 ? (
            <div className="sv-state" style={{ paddingTop: 36, paddingBottom: 36 }}>
              <div className="emoji" aria-hidden="true">{filter === 'active' ? '🎉' : '🗂'}</div>
              <h2>{filter === 'active' ? 'Nothing waiting on us' : 'Nothing here yet'}</h2>
              <p>{filter === 'active' ? 'You have no open tickets right now.' : 'Resolved and closed tickets will show up here.'}</p>
            </div>
          ) : (
            <div className="sv-tickets">
              {shown.map((t) => <TicketRow key={t.id} ticket={t} isNew={hasNewReply(t, seen)} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}
