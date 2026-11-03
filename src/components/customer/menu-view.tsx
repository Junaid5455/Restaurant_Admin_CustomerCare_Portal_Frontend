'use client';

import './menu-page.css';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ItemModal } from './item-modal';
import { MenuBrowser } from './menu-browser';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { clearDineIn, readDineIn, saveDineIn, type DineIn } from '@/lib/dine-in';
import { useBookableRestaurants } from '@/hooks/use-my-reservations';
import { useCart } from '@/hooks/use-cart';
import { restaurantsApi, type MenuItem } from '@/lib/api/restaurants';
import { parseError } from '@/lib/errors';
import { formatMoney, formatTime, isOpenNow, toNumber } from '@/lib/format';

const LAST_KEY = 'sv-menu-restaurant';

const readLast = () => {
  try { return window.localStorage.getItem(LAST_KEY) ?? ''; } catch { return ''; }
};
const saveLast = (id: string) => {
  try { window.localStorage.setItem(LAST_KEY, id); } catch { /* private mode: just don't remember it */ }
};

/**
 * The "Menu" page: pick a restaurant, browse its menu and add dishes to the cart.
 * It starts on the restaurant linked in the address, then the one in the cart, then the last one looked at, then the first.
 */
export function MenuView() {
  const params = useSearchParams();
  const preset = params.get('restaurant') ?? '';
  const list = useBookableRestaurants();
  const cart = useCart();

  const [chosen, setChosen] = useState('');
  const [last, setLast] = useState('');
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [dineIn, setDineIn] = useState<DineIn | null>(null);

  // Read after the first paint so the server and the browser render the same thing.
  useEffect(() => { setLast(readLast()); }, []);

  // Opened from a booking ("Order food"): remember it so the cart and checkout can pick up the table.
  const fromBooking = params.get('dinein') === '1' && !!preset;
  useEffect(() => {
    if (fromBooking) {
      const d: DineIn = { restaurant: preset, table: params.get('table') ?? '', guests: Number(params.get('guests')) || 2, when: params.get('at') ?? '' };
      saveDineIn(d);
      setDineIn(d);
    } else {
      setDineIn(readDineIn());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromBooking, preset]);

  // A restaurant linked from elsewhere may not be on the first page of the list, so look it up on its own.
  const presetQ = useQuery({ queryKey: ['restaurant', preset], queryFn: () => restaurantsApi.get(preset), enabled: !!preset, retry: false });
  const options = useMemo(() => {
    const rows = (list.data ?? []).map((r) => ({ id: r.id, name: r.name }));
    if (presetQ.data && !rows.some((r) => r.id === presetQ.data.id)) rows.unshift({ id: presetQ.data.id, name: presetQ.data.name });
    return rows;
  }, [list.data, presetQ.data]);

  const known = (id: string) => !!id && options.some((o) => o.id === id);
  const cartRestaurant = cart.data?.restaurant ?? '';
  const id = [chosen, preset, cartRestaurant, last].find(known) ?? options[0]?.id ?? '';

  const restaurantQ = useQuery({ queryKey: ['restaurant', id], queryFn: () => restaurantsApi.get(id), enabled: !!id });
  const menuQ = useQuery({ queryKey: ['restaurant-menu', id], queryFn: () => restaurantsApi.menu(id), enabled: !!id });
  const r = restaurantQ.data;
  const open = r ? isOpenNow(r) : false;

  function pick(next: string) {
    setChosen(next);
    setSelected(null);
    if (next) saveLast(next);
  }

  return (
    <>
      <div className="sv-page-head">
        <h1>Menu</h1>
        <p>Pick a restaurant, choose your dishes and order for delivery or pickup.</p>
      </div>

      <div className="card mp-picker">
        <div className="field" style={{ flex: 1, minWidth: 220 }}>
          <label className="field-label" htmlFor="mp-restaurant">Restaurant</label>
          <select id="mp-restaurant" className="input sv-select-input" value={id} onChange={(e) => pick(e.target.value)} disabled={list.isPending && !options.length}>
            {!id && <option value="">{list.isPending ? 'Loading restaurants…' : 'No restaurants yet'}</option>}
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        {r && (
          <div className="mp-facts" aria-label="About this restaurant">
            <span className={`badge ${open ? 'badge-good' : 'badge-crit'}`}>{open ? '● Open now' : '● Closed'}</span>
            {r.allows_delivery && <span className="badge badge-accent">🛵 Delivery{toNumber(r.delivery_fee) > 0 ? ` · ${formatMoney(r.delivery_fee)}` : ' · Free'}</span>}
            {r.allows_pickup && <span className="badge badge-accent">🥡 Pickup</span>}
            {toNumber(r.min_order_amount) > 0 && <span className="badge">Min {formatMoney(r.min_order_amount)}</span>}
          </div>
        )}
      </div>

      {list.isError && !options.length ? (
        <div className="sv-state">
          <div className="emoji" aria-hidden="true">⚠️</div>
          <h2>Couldn’t load restaurants</h2>
          <p>{parseError(list.error).display}</p>
          <Button variant="ghost" onClick={() => void list.refetch()}>Try again</Button>
        </div>
      ) : list.isSuccess && options.length === 0 ? (
        <div className="sv-state">
          <div className="emoji" aria-hidden="true">🍽</div>
          <h2>No restaurants yet</h2>
          <p>Restaurants will show up here as soon as they join.</p>
        </div>
      ) : !id ? (
        <div className="sv-items" aria-busy="true" aria-label="Loading menu">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="sv-skel" style={{ height: 124, borderRadius: 14 }} />)}
        </div>
      ) : (
        <>
          {r && (
            <div className="mp-links">
              <Link href={`/customer/restaurants/${r.id}`} className="sv-link-btn">About {r.name} →</Link>
              {r.allows_dine_in && <Link href={`/customer/reservations/new?restaurant=${r.id}`} className="sv-link-btn">📅 Book a table</Link>}
            </div>
          )}
          {r && dineIn && dineIn.restaurant === r.id && (
            <div className="sv-banner-note mp-dinein" role="status">
              <span aria-hidden="true">🍽</span>
              <span>
                <strong>Ordering for your table at {r.name}</strong>
                {dineIn.when && !Number.isNaN(Date.parse(dineIn.when)) && <> · {new Date(dineIn.when).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {formatTime(new Date(dineIn.when).toTimeString().slice(0, 5))}</>}
                {dineIn.table && <> · Table {dineIn.table}</>}
                <br />
                At checkout this becomes a dine-in order. The kitchen starts once the restaurant confirms it, so it is best to order when you are about to arrive.{' '}
                <button type="button" className="sv-link-btn" onClick={() => { clearDineIn(); setDineIn(null); }}>Not dining in? Clear</button>
              </span>
            </div>
          )}
          {r && !open && (
            <div className="sv-banner-note" role="status">
              <span aria-hidden="true">🕒</span>
              <span>Closed right now (open {formatTime(r.opening_time)} – {formatTime(r.closing_time)}). You can browse the menu, but your order may not be accepted until it opens.</span>
            </div>
          )}
          {restaurantQ.isError && <Alert>{parseError(restaurantQ.error).display}</Alert>}
          {menuQ.isPending ? (
            <div className="sv-items" aria-busy="true" aria-label="Loading menu">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="sv-skel" style={{ height: 124, borderRadius: 14 }} />)}
            </div>
          ) : menuQ.isError ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
              <Alert>{parseError(menuQ.error).display}</Alert>
              <Button variant="ghost" onClick={() => void menuQ.refetch()}>Try again</Button>
            </div>
          ) : (
            <MenuBrowser key={id} restaurantId={id} categories={menuQ.data} onSelect={setSelected} />
          )}
        </>
      )}

      {selected && r && <ItemModal key={selected.id} item={selected} restaurant={{ id: r.id, name: r.name }} onClose={() => setSelected(null)} />}
    </>
  );
}
