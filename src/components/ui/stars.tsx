import './stars.css';

/** Read-only stars. "★★★★☆" with a text label for screen readers. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="st" role="img" aria-label={`${Number.isInteger(value) ? value : value.toFixed(1)} out of 5 stars`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`st-star ${n <= rounded ? 'on' : ''}`} aria-hidden="true">★</span>)}
    </span>
  );
}

/** Pick 1 to 5 stars. A radio group, so it works with the keyboard and screen readers. */
export function StarInput({ value, onChange, label = 'Rating' }: { value: number; onChange: (n: number) => void; label?: string }) {
  return (
    <div className="st-input" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          className={n <= value ? 'on' : ''}
          tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
          onClick={() => onChange(n)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)); }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(1, (value || 2) - 1)); }
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
