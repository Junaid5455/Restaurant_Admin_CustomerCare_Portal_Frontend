'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AccountShell, REWARDS_KEY, SectionSkeleton } from './account-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { accountApi, type GiftCard } from '@/lib/api/account';
import { parseError } from '@/lib/errors';
import { formatMoney, toNumber } from '@/lib/format';

function expiryText(iso: string | null): { text: string; expired: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const text = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return { text, expired: d.getTime() < Date.now() };
}

function GiftCardRow({ card }: { card: GiftCard }) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);
  const exp = expiryText(card.expires_at);

  async function copy() {
    try {
      await navigator.clipboard.writeText(card.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      push("Couldn't copy the code. Select and copy it instead.", 'error');
    }
  }

  return (
    <li className={`card sv-gift ${exp?.expired ? 'off' : ''}`}>
      <div className="sv-gift-main">
        <div className="sv-gift-balance">{formatMoney(card.balance)}</div>
        <div className="sv-gift-sub">of {formatMoney(card.initial_amount)}</div>
      </div>
      <div className="sv-gift-code">
        <code aria-label="Gift card code">{card.code}</code>
        <button type="button" className="sv-link-btn" onClick={copy} aria-label={`Copy gift card code ${card.code}`}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <div className="sv-gift-foot">
        {exp ? (
          <span className={`badge ${exp.expired ? 'badge-crit' : 'badge-violet'}`}>{exp.expired ? 'Expired' : 'Expires'} {exp.text}</span>
        ) : (
          <span className="badge badge-good">No expiry</span>
        )}
      </div>
    </li>
  );
}

export function RewardsView() {
  const rewards = useQuery({ queryKey: REWARDS_KEY, queryFn: accountApi.rewards, staleTime: 60_000 });
  const gifts = useQuery({ queryKey: ['gift-cards'], queryFn: accountApi.giftCards });

  const r = rewards.data;
  const avg = r && r.total_orders > 0 ? toNumber(r.total_spent) / r.total_orders : 0;

  return (
    <AccountShell active="rewards" title="Loyalty & rewards" description="Your points, lifetime activity and gift cards.">
      {rewards.isPending ? (
        <SectionSkeleton rows={1} height={170} />
      ) : rewards.isError ? (
        <div className="sv-acct-inline">
          <Alert>{parseError(rewards.error).display}</Alert>
          <Button variant="ghost" onClick={() => rewards.refetch()}>Try again</Button>
        </div>
      ) : (
        <section className="card sv-points" aria-label="Loyalty points">
          <div className="sv-points-main">
            <span className="sv-points-label">Your points</span>
            <span className="sv-points-num">{r!.loyalty_points.toLocaleString('en-US')}</span>
          </div>
          <dl className="sv-points-stats">
            <div>
              <dt>Orders placed</dt>
              <dd>{r!.total_orders.toLocaleString('en-US')}</dd>
            </div>
            <div>
              <dt>Total spent</dt>
              <dd>{formatMoney(r!.total_spent)}</dd>
            </div>
            <div>
              <dt>Average order</dt>
              <dd>{r!.total_orders > 0 ? formatMoney(avg) : '—'}</dd>
            </div>
          </dl>
          <div className="sv-points-cta">
            <Link href="/customer/orders" className="btn btn-ghost">View order history</Link>
            <Link href="/customer/restaurants" className="btn btn-primary">Order now</Link>
          </div>
        </section>
      )}

      <section aria-labelledby="gift-h" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 id="gift-h" className="sv-acct-h" style={{ fontSize: 18 }}>Gift cards</h2>
        {gifts.isPending ? (
          <SectionSkeleton rows={1} height={120} />
        ) : gifts.isError ? (
          <div className="sv-acct-inline">
            <Alert>{parseError(gifts.error).display}</Alert>
            <Button variant="ghost" onClick={() => gifts.refetch()}>Try again</Button>
          </div>
        ) : gifts.data.length === 0 ? (
          <div className="card sv-acct-card">
            <p className="sv-acct-note" style={{ margin: 0 }}>You don’t have any active gift cards.</p>
          </div>
        ) : (
          <>
            <ul className="sv-acct-list sv-gift-grid">
              {gifts.data.map((c) => <GiftCardRow key={c.id} card={c} />)}
            </ul>
            <p className="sv-acct-note">Gift cards can’t be applied at checkout yet.</p>
          </>
        )}
      </section>
    </AccountShell>
  );
}
