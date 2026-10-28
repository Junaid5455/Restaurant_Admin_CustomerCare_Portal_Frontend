'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Kpi } from './analytics-kit';
import { Pager } from './orders-kit';
import { Chips, LoadError, PageHead, TableSkeleton } from './super-kit';
import { Button } from '@/components/ui/submit-button';
import { useOwnerTickets } from '@/hooks/use-owner-tickets';
import { CATEGORIES, CATEGORY_ICON, CATEGORY_LABEL, TICKET_STATUS_LABEL, ticketBadgeClass, type TicketCategory } from '@/lib/api/support';
import { inGroup, lastMessageAt, needsReply, ownerTicketStats, sortForOwner, type TicketGroup } from '@/lib/owner-tickets';
import { PRIORITY_LABEL, priorityBadge } from '@/lib/super-admin';
import { timeAgo } from '@/lib/time-ago';

const PAGE = 15;

export function OwnerTicketsView() {
  const q = useOwnerTickets();
  const [group, setGroup] = useState<TicketGroup>('reply');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const all = useMemo(() => q.data?.tickets ?? [], [q.data]);
  const stats = useMemo(() => ownerTicketStats(all), [all]);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all
      .filter((t) => inGroup(t, group) && (!category || t.category === category) && (!s || [t.subject, t.ticket_id, t.customer_email].some((v) => v?.toLowerCase().includes(s))))
      .sort(sortForOwner);
  }, [all, group, category, search]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const at = Math.min(page, pages);
  const view = shown.slice((at - 1) * PAGE, at * PAGE);
  const reset = () => { setGroup('all'); setCategory(''); setSearch(''); setPage(1); };
  const count = (g: TicketGroup) => all.filter((t) => inGroup(t, g)).length;

  return (
    <>
      <PageHead title="Tickets" description="Guest requests about your restaurant. Ones waiting on you come first." />
      <div className="ad-stack">
        <div className="ad-kpis">
          <Kpi tone="coral" icon="💬" label="Need a reply" value={q.data ? String(stats.needReply) : null} sub={stats.needReply ? 'The guest wrote last' : 'You’re all caught up'} loading={q.isPending} />
          <Kpi tone="yellow" icon="🎫" label="Open" value={q.data ? String(stats.open) : null} sub="Not resolved or closed" loading={q.isPending} />
          <Kpi tone="violet" icon="⏳" label="Longest wait" value={q.data ? (stats.oldestWaitingAt ? timeAgo(stats.oldestWaitingAt).replace(' ago', '') : '—') : null} sub="Since the guest last wrote" loading={q.isPending} />
          <Kpi tone="teal" icon="✅" label="Done this week" value={q.data ? String(stats.doneThisWeek) : null} sub="Resolved or closed" loading={q.isPending} />
        </div>

        {q.isError ? <LoadError query={q} what="tickets" /> : q.isPending ? <TableSkeleton /> : (
          <>
            <div className="su-toolbar">
              <Chips label="Show" value={group} onChange={(v) => { setGroup(v); setPage(1); }} options={[
                { id: 'reply', label: 'Needs reply', count: count('reply') },
                { id: 'open', label: 'Open', count: count('open') },
                { id: 'done', label: 'Resolved', count: count('done') },
                { id: 'all', label: 'All', count: all.length },
              ]} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select className="ad-input su-select" aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                  <option value="">Any category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c as TicketCategory]}</option>)}
                </select>
                <input className="ad-input su-search" type="search" aria-label="Search tickets" placeholder="Subject, ticket number or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="card ad-empty">
                <div className="ad-empty-icon" aria-hidden="true">{all.length === 0 ? '🎫' : group === 'reply' && !search && !category ? '🎉' : '🔍'}</div>
                {all.length === 0 ? (
                  <><strong>No tickets yet</strong><span>When a guest reports a problem with one of your orders, it shows up here.</span></>
                ) : group === 'reply' && !search && !category ? (
                  <><strong>Nothing needs a reply</strong><span>Every open ticket has your answer on it.</span><Button variant="ghost" onClick={() => setGroup('open')}>See open tickets</Button></>
                ) : (
                  <><strong>Nothing here</strong><span>No tickets match these filters.</span><Button variant="ghost" onClick={reset}>Show all tickets</Button></>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="ad-table-wrap">
                  <table className="ad-table su-table">
                    <caption className="sr-only">Guest tickets</caption>
                    <thead><tr><th scope="col">Ticket</th><th scope="col">Category</th><th scope="col">Priority</th><th scope="col">Status</th><th scope="col">Last activity</th><th scope="col">Turn</th></tr></thead>
                    <tbody>
                      {view.map((t) => (
                        <tr key={t.id}>
                          <th scope="row">
                            <Link href={`/owner/tickets/${t.id}`} className="su-name">{t.subject}</Link>
                            <div className="su-sub">{t.ticket_id} · {t.customer_email}</div>
                          </th>
                          <td><span aria-hidden="true">{CATEGORY_ICON[t.category]} </span>{CATEGORY_LABEL[t.category] ?? t.category}</td>
                          <td><span className={`badge ${priorityBadge(t.priority)}`}>{PRIORITY_LABEL[t.priority] ?? t.priority}</span></td>
                          <td><span className={`badge ${ticketBadgeClass(t.status) || 'badge-neutral'}`}>{TICKET_STATUS_LABEL[t.status]}</span></td>
                          <td>{timeAgo(lastMessageAt(t))}</td>
                          <td>{needsReply(t) ? <span className="badge badge-warn">Your reply</span> : <span className="su-you">{t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'Done' : 'Guest’s turn'}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Pager page={at} totalPages={pages} totalItems={shown.length} noun="tickets" onPage={setPage} />
            {q.data && q.data.total > all.length && <p className="an-note">Showing your latest {all.length} of {q.data.total} tickets.</p>}
          </>
        )}
      </div>
    </>
  );
}
