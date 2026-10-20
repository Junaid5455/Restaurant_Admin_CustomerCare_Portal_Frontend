'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from './cart-line';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { TICKETS_KEY, ticketKey } from '@/hooks/use-tickets';
import { ordersApi } from '@/lib/api/orders';
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  TICKET_STATUS_HELP,
  TICKET_STATUS_LABEL,
  latestStaffAt,
  sortedMessages,
  supportApi,
  ticketBadgeClass,
  type Ticket,
  type TicketMessage,
} from '@/lib/api/support';
import { parseError } from '@/lib/errors';
import { mediaUrl } from '@/lib/format';
import { formatDateTime } from '@/lib/pickup';
import { markSeen } from '@/lib/support-seen';

const MAX_LEN = 2000;
const MAX_FILE = 5 * 1024 * 1024;
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const IMAGE_RE = /\.(png|jpe?g|webp|gif)(\?.*)?$/i;

function fileName(url: string): string {
  try {
    return decodeURIComponent(url.split('?')[0].split('/').pop() || 'attachment');
  } catch {
    return 'attachment';
  }
}

function Attachment({ url }: { url: string }) {
  const href = mediaUrl(url);
  if (!href) return null;
  return IMAGE_RE.test(url) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="sv-chat-img" aria-label={`Open attachment ${fileName(url)}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={href} alt={`Attachment: ${fileName(url)}`} loading="lazy" />
    </a>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className="sv-chat-file">
      📎 {fileName(url)}
    </a>
  );
}

function Bubble({ mine, who, time, text, attachment, tag }: { mine: boolean; who: string; time: string; text: string; attachment?: string | null; tag?: string }) {
  return (
    <li className={`sv-bubble ${mine ? 'mine' : 'theirs'}`}>
      <div className="sv-bubble-meta">
        <strong>{who}</strong>
        {tag && <span className="sv-bubble-tag">{tag}</span>}
        <time>{formatDateTime(time)}</time>
      </div>
      {text && <div className="sv-bubble-body">{text}</div>}
      {attachment && <Attachment url={attachment} />}
    </li>
  );
}

function RelatedOrder({ orderId }: { orderId: string }) {
  // Best effort: the ticket only carries the order's id, so look up its number. Failure just hides the chip.
  const order = useQuery({ queryKey: ['order', orderId], queryFn: () => ordersApi.get(orderId), staleTime: 60_000, retry: false });
  if (!order.data) return null;
  return (
    <Link href={`/customer/orders/${orderId}`} className="sv-chip-link">
      🧾 Order #{order.data.order_number} · {order.data.restaurant_name}
    </Link>
  );
}

export function SupportTicketView({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const { push } = useToast();

  const ticket = useQuery({
    queryKey: ticketKey(ticketId),
    queryFn: () => supportApi.get(ticketId),
    // New staff replies show up without a refresh; stops once the ticket is closed.
    refetchInterval: (q) => (q.state.data?.status === 'CLOSED' ? false : 15_000),
  });
  const t = ticket.data;

  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [announce, setAnnounce] = useState('');

  const fileInput = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLOListElement>(null);
  const nearBottom = useRef(true);
  const lastCount = useRef(0);

  const messages = useMemo(() => (t ? sortedMessages(t) : []), [t]);

  // Remember that the customer has seen the latest staff reply (drives the "New reply" badge in the list).
  useEffect(() => {
    if (!t) return;
    const latest = latestStaffAt(t);
    if (latest) markSeen(t.id, latest);
  }, [t]);

  // Keep the newest message in view, unless the customer has scrolled up to read history.
  useEffect(() => {
    const el = log.current;
    if (!el || !t) return;
    const grew = messages.length > lastCount.current;
    if (grew && (nearBottom.current || lastCount.current === 0)) el.scrollTop = el.scrollHeight;
    if (grew && lastCount.current > 0) {
      const newest = messages.at(-1);
      if (newest && newest.message_type === 'STAFF_MESSAGE') setAnnounce('New reply from the support team');
    }
    lastCount.current = messages.length;
  }, [messages, t]);

  function onScroll() {
    const el = log.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!FILE_TYPES.includes(f.type)) return setSendError('Attach an image (JPG, PNG, WebP, GIF) or a PDF.');
    if (f.size > MAX_FILE) return setSendError('That file is larger than 5 MB. Choose a smaller one.');
    setSendError(null);
    setFile(f);
  }

  async function send() {
    if (!t || sending) return;
    const body = text.trim();
    if (!body && !file) return;
    if (!body) return setSendError('Add a short message to go with your attachment.');
    setSending(true);
    setSendError(null);
    try {
      const created = await supportApi.addMessage(t.id, body, file);
      nearBottom.current = true;
      queryClient.setQueryData<Ticket>(ticketKey(t.id), (old) =>
        old && !old.messages.some((m) => m.id === created.id) ? { ...old, messages: [...old.messages, created] } : old,
      );
      setText('');
      setFile(null);
      void queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
    } catch (e) {
      // Keep what they typed so nothing is lost.
      setSendError(parseError(e).display);
    } finally {
      setSending(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send();
    }
  }

  async function close() {
    if (!t) return;
    setClosing(true);
    try {
      await supportApi.close(t.id);
      push('Ticket closed');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKey(t.id) }),
        queryClient.invalidateQueries({ queryKey: TICKETS_KEY }),
      ]);
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      setClosing(false);
      setConfirmClose(false);
    }
  }

  const back = <Link href="/customer/support" className="sv-back">← All tickets</Link>;

  if (ticket.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading ticket">
        {back}
        <div className="sv-skel" style={{ height: 130, margin: '14px 0' }} />
        <div className="sv-skel" style={{ height: 320 }} />
      </div>
    );
  }
  // A failed background refresh must not wipe a conversation the customer is reading.
  if (!t) {
    const err = parseError(ticket.error);
    return (
      <div>
        {back}
        <div className="sv-state" style={{ marginTop: 14 }}>
          <div className="emoji" aria-hidden="true">{err.status === 404 ? '🔎' : '⚠️'}</div>
          <h2>{err.status === 404 ? 'We couldn’t find that ticket' : 'We couldn’t load this ticket'}</h2>
          <p>{err.status === 404 ? 'It may have been removed, or it belongs to another account.' : err.display}</p>
          {err.status === 404 ? (
            <Link href="/customer/support" className="btn btn-primary">Back to support</Link>
          ) : (
            <Button onClick={() => ticket.refetch()}>Try again</Button>
          )}
        </div>
      </div>
    );
  }

  const closed = t.status === 'CLOSED';
  const resolved = t.status === 'RESOLVED';
  const asMessage = (m: TicketMessage) => (
    <Bubble
      key={m.id}
      mine={m.message_type === 'CUSTOMER_MESSAGE'}
      who={m.message_type === 'CUSTOMER_MESSAGE' ? 'You' : 'Support team'}
      time={m.created_at}
      text={m.message}
      attachment={m.attachment}
    />
  );

  return (
    <div>
      {back}

      <section className="card sv-confirm sv-ticket-head" style={{ marginTop: 14 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="sv-eyebrow">Ticket #{t.ticket_id} · {formatDateTime(t.created_at)}</p>
          <h1>{t.subject}</h1>
          <p>{TICKET_STATUS_HELP[t.status]}</p>
          <div className="sv-confirm-chips">
            <span className={`badge ${ticketBadgeClass(t.status)}`}>{TICKET_STATUS_LABEL[t.status]}</span>
            <span className="badge badge-violet">{CATEGORY_ICON[t.category]} {CATEGORY_LABEL[t.category]}</span>
            {t.related_order && <RelatedOrder orderId={t.related_order} />}
          </div>
        </div>
        {!closed && (
          <Button variant="ghost" onClick={() => setConfirmClose(true)}>Close ticket</Button>
        )}
      </section>

      <section className="card sv-chat" aria-labelledby="chat-h">
        <h2 id="chat-h" className="sv-acct-h">Conversation</h2>
        <ol ref={log} className="sv-chat-log" onScroll={onScroll} role="log" aria-label="Conversation messages" tabIndex={0}>
          <Bubble mine who="You" tag="Original request" time={t.created_at} text={t.description} />
          {messages.map(asMessage)}
        </ol>
        <div className="sr-only" role="status" aria-live="polite">{announce}</div>

        {closed ? (
          <div className="sv-chat-closed">
            <p>This ticket is closed, so you can’t send more messages.</p>
            <Link href={`/customer/support/new${t.related_order ? `?order=${t.related_order}` : ''}`} className="btn btn-primary">Open a new ticket</Link>
          </div>
        ) : (
          <form
            className="sv-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {resolved && (
              <p className="sv-acct-note">This ticket is marked resolved. Replying won’t reopen it automatically, so open a new ticket if the problem continues.</p>
            )}
            <label htmlFor="chat-msg" className="sr-only">Your message</label>
            <textarea
              id="chat-msg"
              className="input sv-textarea"
              rows={3}
              maxLength={MAX_LEN}
              placeholder="Write a message…  (Ctrl+Enter to send)"
              value={text}
              onChange={(e) => { setText(e.target.value); if (sendError) setSendError(null); }}
              onKeyDown={onKey}
              disabled={sending}
            />
            {file && (
              <div className="sv-attach-chip">
                <span>📎 {file.name}</span>
                <button type="button" className="sv-link-btn" onClick={() => setFile(null)} aria-label={`Remove attachment ${file.name}`}>Remove</button>
              </div>
            )}
            {sendError && <Alert>{sendError}</Alert>}
            <div className="sv-composer-actions">
              <input ref={fileInput} type="file" hidden accept={FILE_TYPES.join(',')} onChange={onPick} aria-label="Attach a file" />
              <Button type="button" variant="ghost" onClick={() => fileInput.current?.click()} disabled={sending}>📎 Attach</Button>
              <span className="sv-count" aria-hidden="true">{text.length} / {MAX_LEN}</span>
              <Button type="submit" loading={sending} loadingText="Sending…" disabled={!text.trim() && !file}>Send</Button>
            </div>
          </form>
        )}
      </section>

      {confirmClose && (
        <ConfirmDialog
          title="Close this ticket?"
          message="You won’t be able to send more messages on it. If the problem comes back, you can open a new ticket."
          confirmLabel="Close ticket"
          busy={closing}
          onConfirm={close}
          onClose={() => !closing && setConfirmClose(false)}
        />
      )}
    </div>
  );
}
