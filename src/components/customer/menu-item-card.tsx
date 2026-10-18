import { SafeImage } from '@/components/ui/safe-image';
import type { MenuItem } from '@/lib/api/restaurants';
import { formatMoney, toNumber } from '@/lib/format';

export function MenuItemCard({ item, onSelect }: { item: MenuItem; onSelect: (item: MenuItem) => void }) {
  const hasRating = item.review_count > 0 && toNumber(item.rating) > 0;
  return (
    <button type="button" className="sv-item" onClick={() => onSelect(item)} aria-label={`${item.name}, ${formatMoney(item.price)}. Customize and add to cart`}>
      <div className="sv-item-media">
        <SafeImage src={item.image} alt="" fallback={<span aria-hidden="true">🍴</span>} />
      </div>
      <div className="sv-item-body">
        <div className="sv-item-name">
          {item.name}
          {item.is_new && <span className="badge badge-violet">New</span>}
          {item.is_featured && <span className="badge badge-warn">⭐ Featured</span>}
        </div>
        {item.description && <div className="sv-item-desc">{item.description}</div>}
        <div className="sv-item-foot">
          <span className="sv-price">{formatMoney(item.price)}</span>
          <span>⏱ {item.prep_time} min</span>
          {hasRating && <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>★ {toNumber(item.rating).toFixed(1)}</span>}
          <span className="sv-add" aria-hidden="true">+</span>
        </div>
      </div>
    </button>
  );
}
