const STEPS = ['Cart', 'Details', 'Payment', 'Done'] as const;

/** 0 = cart, 1 = checkout details, 2 = payment, 3 = confirmation */
export function CheckoutSteps({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="sv-steps" aria-label="Checkout progress">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className={i < current ? 'done' : i === current ? 'current' : ''}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="dot" aria-hidden="true">{i < current ? '✓' : i + 1}</span>
          <span className="txt">{label}</span>
        </li>
      ))}
    </ol>
  );
}
