/** Centered prompt when user must select an org or list is empty. */
export function OnboardingEmptyState({ title, description, fill = false }) {
  return (
    <div
      className={`cp-empty-state${fill ? ' cp-empty-state--fill' : ''}`}
      role="status"
    >
      <span className="cp-empty-state__icon" aria-hidden>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="17" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M19 13l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <h3 className="cp-empty-state__title">{title}</h3>
      {description ? <p className="cp-empty-state__desc">{description}</p> : null}
    </div>
  );
}
