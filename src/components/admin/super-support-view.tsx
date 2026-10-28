'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Kpi } from './analytics-kit';
import { Pager } from './orders-kit';
import { Chips, LoadError, PageHead, TableSkeleton } from './super-kit';
import { Button } from '@/components/ui/submit-button';
import { useAllTickets } from '@/hooks/use-super-admin';
import { CATEGORIES, CATEGORY_LABEL, TICKET_STATUS_LABEL, ticketBadgeClass, type TicketCategory } from '@/lib/api/support';
import { PRIORITIES, PRIORITY_LABEL, byAttention, hasStaffReply, isOpenTicket, priorityBadge, ticketStats } from '@/lib/super-admin';
import { timeAgo } from '@/lib/time-ago';

const PAGE = 20;
type Group = 'open' | 'waiting' | 'done' | 'all';

export function SuperSupportView() {
  const q = useAllTickets();
  const [group, setGroup] = useState<Group>('open');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const all = useMemo(() => q.data?.tickets ?? [], [q.data]);
  const stats = useMemo(() => ticketStats(all), [all]);
  const inGroup = (status: string, g: Group) => g === 'all' || (g === 'open' ? status === 'OPEN' || status === 'IN_PROGRESS' : g === 'waiting' ? status.startsWith('WAITING') : status === 'RESOLVED' || status === 'CLOSED');
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all
      .filter((t) => inGroup(t.status, group) && (!priority || t.priority === priority) && (!category || t.category === category) && (!s || [t.subject, t.ticket_id, t.customer_email].some((v) => v?.toLowerCase().includes(s))))
      .sort(group === 'done' || group === 'all' ? (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) : byAttention);
  }, [all, group, priority, category, search]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const at = Math.min(page, pages);
  const view = shown.slice((at - 1) * PAGE, at * PAGE);
  const reset = () => { setGroup('all'); setPriority(''); setCategory(''); setSearch(''); };

  return (
    <>
      <PageHead title="Support" description="Every ticket from customers and restaurants, most urgent first." />
      <div className="ad-stack">
        <div className="ad-kpis">
          <Kpi tone="coral" icon="🎫" label="Open" value={q.data ? String(stats.open) : null} sub="Not resolved or closed" loading={q.isPending} />
          <Kpi tone="yellow" icon="🔥" label="High or urgent" value={q.data ? String(stats.urgentOpen) : null} sub="Still open" loading={q.isPending} />
          <Kpi tone="violet" icon="💬" label="No reply yet" value={q.data ? String(stats.unanswered) : null} sub="Open, nobody has answered" loading={q.isPending} />
          <Kpi tone="teal" icon="⏳" label="Oldest open" value={q.data ? (stats.oldestOpenAt ? timeAgo(stats.oldestOpenAt).replace(' ago', '') : '—') : null} sub="Waiting the longest" loading={q.isPending} />
        </div>

        {q.isError ? <LoadError query={q} what="tickets" /> : q.isPending ? <TableSkeleton /> : (
          <>
            <div className="su-toolbar">
              <Chips label="Show" value={group} onChange={(v) => { setGroup(v); setPage(1); }} options={[
                { id: 'open', label: 'Open', count: all.filter((t) => inGroup(t.status, 'open')).length },
                { id: 'waiting', label: 'Waiting', count: all.filter((t) => inGroup(t.status, 'waiting')).length },
                { id: 'done', label: 'Resolved', count: all.filter((t) => inGroup(t.status, 'done')).length },
                { id: 'all', label: 'All', count: all.length },
              ]} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select className="ad-input su-select" aria-label="Priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
                  <option value="">Any priority</option>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
                <select className="ad-input su-select" aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                  <option value="">Any category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c as TicketCategory]}</option>)}
                </select>
                <input className="ad-input su-search" type="search" aria-label="Search tickets" placeholder="Subject, ticket number or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="card ad-empty">
                <div className="ad-empty-icon" aria-hidden="true">🎫</div>
                {all.length === 0 ? <><strong>No tickets yet</strong><span>Customer requests will show up here.</span></> : <><strong>Nothing here</strong><span>No tickets match these filters.</span><Button variant="ghost" onClick={reset}>Show all tickets</Button></>}
              </div>
            ) : (
              <div className="card">
                <div className="ad-table-wrap">
                  <table className="ad-table su-table">
                    <caption className="sr-only">Support tickets</caption>
                    <thead><tr><th scope="col">Ticket</th><th scope="col">Category</th><th scope="col">Priority</th><th scope="col">Status</th><th scope="col">Opened</th><th scope="col">Replies</th></tr></thead>
                    <tbody>
                      {view.map((t) => (
                        <tr key={t.id}>
                          <th scope="row">
                            <Link href={`/admin/support/${t.id}`} className="su-name">{t.subject}</Link>
                            <div className="su-sub">{t.ticket_id} · {t.customer_email}</div>
                          </th>
                          <td>{CATEGORY_LABEL[t.category] ?? t.category}</td>
                          <td><span className={`badge ${priorityBadge(t.priority)}`}>{PRIORITY_LABEL[t.priority] ?? t.priority}</span></td>
                          <td><span className={`badge ${ticketBadgeClass(t.status) || 'badge-neutral'}`}>{TICKET_STATUS_LABEL[t.status]}</span></td>
                          <td>{timeAgo(t.created_at)}</td>
                          <td>{t.messages.length}{isOpenTicket(t) && !hasStaffReply(t) ? <span className="su-you"> · none from us</span> : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Pager page={at} totalPages={pages} totalItems={shown.length} noun="tickets" onPage={setPage} />
            {q.data && !q.data.complete && <p className="an-note">Showing your latest 500 tickets.</p>}
          </>
        )}
      </div>
    </>
  );
}
